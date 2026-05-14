import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

interface SyncError {
  code: string
  message: string
  context: Record<string, unknown>
}

interface SyncResult {
  type: string
  companyId: string
  success: boolean
  recordsFetched: number
  recordsWritten: number
  errors: SyncError[]
  durationMs: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEXIO_API_BASE = 'https://api.bexio.com/2.0'
const RATE_LIMIT_DELAY_MS = 300
const PAGE_SIZE = 100

const BEXIO_STATUS_MAP: Record<number, string> = {
  7: 'draft', 8: 'sent', 9: 'paid', 16: 'partially_paid', 19: 'overdue',
}

const BEXIO_BILL_STATUS_MAP: Record<number, string> = {
  7: 'draft', 8: 'pending', 9: 'paid', 16: 'partially_paid', 19: 'overdue',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function mapInvoiceStatus(statusId: number): string {
  const mapped = BEXIO_STATUS_MAP[statusId]
  return ['draft', 'sent', 'paid', 'overdue', 'partially_paid'].includes(mapped ?? '')
    ? mapped! : 'draft'
}

function mapBillStatus(statusId: number): string {
  const mapped = BEXIO_BILL_STATUS_MAP[statusId]
  switch (mapped) {
    case 'paid': return 'paid'
    case 'overdue': case 'partially_paid': return 'approved'
    case 'pending': return 'in_validation'
    default: return 'received'
  }
}

function computeDueDate(issuedAt: string): string {
  const d = new Date(issuedAt)
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Bexio API client (self-contained, no external deps)
// ---------------------------------------------------------------------------

async function bexioFetch<T>(
  token: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${BEXIO_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After')
    await sleep(retry ? parseInt(retry, 10) * 1000 : 5000)
    return bexioFetch(token, path)
  }
  if (!res.ok) {
    throw new Error(`Bexio ${res.status} for ${path}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Upsert helper
// ---------------------------------------------------------------------------

async function upsertRecords(
  table: string,
  records: Row[],
  conflictKeys: string[],
): Promise<{ written: number; errors: SyncError[] }> {
  if (records.length === 0) return { written: 0, errors: [] }
  const db = createSupabaseServiceClient()
  let written = 0
  const errors: SyncError[] = []

  for (let i = 0; i < records.length; i += PAGE_SIZE) {
    const chunk = records.slice(i, i + PAGE_SIZE)
    const { error, count } = await db
      .from(table)
      .upsert(chunk, { onConflict: conflictKeys.join(','), ignoreDuplicates: false, count: 'exact' })
    if (error) {
      errors.push({ code: error.code ?? 'UPSERT_ERROR', message: error.message, context: { table, chunk: i } })
    } else {
      written += count ?? chunk.length
    }
  }
  return { written, errors }
}

// ---------------------------------------------------------------------------
// Write sync result to DB
// ---------------------------------------------------------------------------

async function writeSyncResult(
  connectorId: string,
  companyId: string,
  startedAt: Date,
  result: { success: boolean; recordsWritten: number; errors: SyncError[] },
): Promise<void> {
  const db = createSupabaseServiceClient()
  const now = new Date().toISOString()

  await db.from('connector_sync_log').insert({
    connector_id: connectorId,
    company_id: companyId,
    status: result.success ? 'success' : 'error',
    records_synced: result.recordsWritten,
    error_message: result.errors.length > 0 ? result.errors.map((e) => e.message).join('; ') : null,
    started_at: startedAt.toISOString(),
    completed_at: now,
  })

  await db.from('connectors').update({
    last_synced_at: now,
    status: result.success ? 'active' : 'error',
    last_error: result.errors.length > 0 ? (result.errors[0]?.message ?? null) : null,
  }).eq('id', connectorId)
}

// ---------------------------------------------------------------------------
// Bexio sync (self-contained)
// ---------------------------------------------------------------------------

async function syncBexio(
  companyId: string,
  connectorId: string,
  credentials: Row,
  lastSyncedAt: string | null,
): Promise<SyncResult> {
  const start = Date.now()
  const errors: SyncError[] = []
  let fetched = 0
  let written = 0

  const token = credentials['access_token'] as string
  if (!token) {
    return { type: 'bexio', companyId, success: false, recordsFetched: 0, recordsWritten: 0, errors: [{ code: 'NO_TOKEN', message: 'No access_token in credentials', context: {} }], durationMs: Date.now() - start }
  }

  const cutoff = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0

  try {
    // 1. Invoices (incremental)
    const invoices: Row[] = []
    let offset = 0
    let hasMore = true
    while (hasMore) {
      try {
        const page = await bexioFetch<Row[]>(token, `/kb_invoice?offset=${offset}&limit=${PAGE_SIZE}&order_by=updated_at&order=DESC`)
        if (page.length === 0) { hasMore = false; break }
        let reachedCutoff = false
        for (const inv of page) {
          if (cutoff > 0 && new Date(inv['updated_at'] as string).getTime() < cutoff) { reachedCutoff = true; break }
          invoices.push(inv)
        }
        if (reachedCutoff || page.length < PAGE_SIZE) hasMore = false
        else offset += PAGE_SIZE
        await sleep(RATE_LIMIT_DELAY_MS)
      } catch (err) {
        errors.push({ code: 'BEXIO_FETCH_INVOICES', message: err instanceof Error ? err.message : String(err), context: { offset } })
        hasMore = false
      }
    }
    fetched += invoices.length

    if (invoices.length > 0) {
      const normalised = invoices.map((inv) => ({
        company_id: companyId,
        external_id: String(inv['id']),
        invoice_number: (inv['document_nr'] as string) ?? `BEXIO-${inv['id']}`,
        customer_name: (inv['title'] as string) ?? `Contact ${inv['contact_id'] ?? 'unknown'}`,
        amount_chf: inv['total_net'],
        tax_chf: inv['total_taxes'],
        total_chf: inv['total_gross'],
        status: mapInvoiceStatus(inv['kb_item_status_id'] as number),
        issued_at: (inv['is_valid_from'] as string) ?? (inv['updated_at'] as string),
        due_at: computeDueDate((inv['is_valid_from'] as string) ?? (inv['updated_at'] as string)),
      }))
      const r = await upsertRecords('invoices', normalised, ['company_id', 'external_id'])
      written += r.written
      errors.push(...r.errors)

      // 2. Payments for synced invoices
      const db = createSupabaseServiceClient()
      for (const inv of invoices) {
        try {
          const payments = await bexioFetch<Row[]>(token, `/kb_invoice/${inv['id']}/payment`)
          if (payments.length === 0) { await sleep(RATE_LIMIT_DELAY_MS); continue }
          const { data: dbInv } = await db.from('invoices').select('id').eq('company_id', companyId).eq('external_id', String(inv['id'])).single()
          if (!dbInv) { await sleep(RATE_LIMIT_DELAY_MS); continue }
          const normPay = payments.map((p) => ({
            company_id: companyId,
            invoice_id: (dbInv as Row)['id'],
            amount_chf: p['value'],
            payment_date: p['date'],
            reference: `bexio-payment-${p['id']}`,
            notes: p['title'],
          }))
          const pr = await upsertRecords('payments', normPay, ['company_id', 'reference'])
          written += pr.written
          errors.push(...pr.errors)
          await sleep(RATE_LIMIT_DELAY_MS)
        } catch (err) {
          errors.push({ code: 'BEXIO_FETCH_PAYMENTS', message: err instanceof Error ? err.message : String(err), context: { invoiceId: inv['id'] } })
        }
      }
    }

    // 3. Contacts -> suppliers (full sync)
    const contacts: Row[] = []
    let cOffset = 0
    while (true) {
      try {
        const page = await bexioFetch<Row[]>(token, `/contact?offset=${cOffset}&limit=${PAGE_SIZE}&order_by=updated_at&order=DESC`)
        if (page.length === 0) break
        contacts.push(...page)
        if (page.length < PAGE_SIZE) break
        cOffset += PAGE_SIZE
        await sleep(RATE_LIMIT_DELAY_MS)
      } catch (err) {
        errors.push({ code: 'BEXIO_FETCH_CONTACTS', message: err instanceof Error ? err.message : String(err), context: { offset: cOffset } })
        break
      }
    }

    if (contacts.length > 0) {
      const db = createSupabaseServiceClient()
      const { data: company } = await db.from('companies').select('holding_id').eq('id', companyId).single()
      const holdingId = (company as Row | null)?.['holding_id'] as string ?? ''
      const normContacts = contacts.map((c) => {
        const name = (c['contact_type_id'] as number) === 1
          ? ((c['name_1'] as string) ?? 'Unknown')
          : [c['name_2'], c['name_1']].filter(Boolean).join(' ') || 'Unknown'
        const countryId = c['country_id'] as number | null
        return {
          company_id: companyId, holding_id: holdingId, external_id: String(c['id']),
          name, address_line_1: c['address'], postal_code: c['postcode'],
          city: c['city'], country: countryId === 1 ? 'CH' : countryId === 2 ? 'DE' : countryId === 3 ? 'AT' : 'CH',
          contact_email: c['mail'], contact_phone: c['phone_fixed'],
          is_active: true, preferred_payment_days: 30,
        }
      })
      const cr = await upsertRecords('suppliers', normContacts, ['company_id', 'external_id'])
      written += cr.written
      fetched += contacts.length
      errors.push(...cr.errors)
    }

    // 4. Bills (Kreditoren) — 404 is expected if module not included
    try {
      const bills: Row[] = []
      let bOffset = 0
      while (true) {
        const page = await bexioFetch<Row[]>(token, `/kb_bill?offset=${bOffset}&limit=${PAGE_SIZE}&order_by=updated_at&order=DESC`)
        if (page.length === 0) break
        let reachedCutoff = false
        for (const bill of page) {
          if (cutoff > 0 && new Date(bill['updated_at'] as string).getTime() < cutoff) { reachedCutoff = true; break }
          bills.push(bill)
        }
        if (reachedCutoff || page.length < PAGE_SIZE) break
        bOffset += PAGE_SIZE
        await sleep(RATE_LIMIT_DELAY_MS)
      }
      if (bills.length > 0) {
        const db = createSupabaseServiceClient()
        const { data: suppliers } = await db.from('suppliers').select('id, external_id').eq('company_id', companyId)
        const supplierMap = new Map((suppliers ?? []).map((s: Row) => [s['external_id'] as string, s['id'] as string]))
        const { data: companyRow } = await db.from('companies').select('holding_id').eq('id', companyId).single()
        const hId = (companyRow as Row | null)?.['holding_id'] as string ?? ''
        const normBills = bills.map((b) => {
          const supplierId = b['contact_id'] ? (supplierMap.get(String(b['contact_id'])) ?? null) : null
          return {
            company_id: companyId, holding_id: hId, external_id: String(b['id']),
            invoice_number: (b['document_nr'] as string) ?? `BEXIO-BILL-${b['id']}`,
            invoice_date: b['is_valid_from'], sender_name: (b['title'] as string) ?? 'Bexio Kreditor',
            supplier_id: supplierId, net_amount: parseFloat(b['total_net'] as string),
            vat_amount: parseFloat(b['total_taxes'] as string), gross_amount: parseFloat(b['total_gross'] as string),
            currency: 'CHF', due_date: b['is_valid_to'],
            status: mapBillStatus(b['kb_item_status_id'] as number),
            extraction_status: 'completed', incomer_type: 'webhook',
            raw_storage_path: `bexio/bills/${b['id']}`, raw_filename: `${(b['document_nr'] as string) ?? b['id']}.pdf`,
          }
        })
        const br = await upsertRecords('invoices_incoming', normBills, ['company_id', 'external_id'])
        written += br.written
        fetched += bills.length
        errors.push(...br.errors)
      }
    } catch (err) {
      // Bills 404 is expected when Bexio plan lacks Kreditoren module — not critical
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ code: 'BEXIO_FETCH_BILLS', message: msg, context: {} })
    }
  } catch (err) {
    errors.push({ code: 'BEXIO_SYNC_FATAL', message: err instanceof Error ? err.message : String(err), context: {} })
  }

  // Bills 404 is expected — don't count as critical
  const criticalErrors = errors.filter((e) => e.code !== 'BEXIO_FETCH_BILLS' || !e.message.includes('404'))

  return {
    type: 'bexio', companyId, success: criticalErrors.length === 0,
    recordsFetched: fetched, recordsWritten: written, errors, durationMs: Date.now() - start,
  }
}

// ---------------------------------------------------------------------------
// GET /api/cron/connector-sync
//
// Vercel Cron job — runs hourly. Checks all active connectors that are due
// for sync (based on their sync_interval_minutes and last_synced_at) and
// triggers the appropriate sync logic.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const now = Date.now()

  // Find all connectors that are active or in error state
  const { data: connectors, error: fetchErr } = await db
    .from('connectors')
    .select('id, company_id, type, credentials, config, sync_interval_minutes, last_synced_at, status')
    .in('status', ['active', 'error'])

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const results: Array<{ type: string; companyId: string; success: boolean; records: number; duration: number }> = []
  let synced = 0
  let skipped = 0

  for (const connector of (connectors ?? []) as Row[]) {
    const connectorId = connector['id'] as string
    const companyId = connector['company_id'] as string
    const type = connector['type'] as string
    const intervalMinutes = (connector['sync_interval_minutes'] as number) ?? 60
    const lastSynced = connector['last_synced_at']
      ? new Date(connector['last_synced_at'] as string).getTime()
      : 0

    // Skip if not due for sync yet
    if (now - lastSynced < intervalMinutes * 60 * 1000) {
      skipped++
      continue
    }

    const startedAt = new Date()
    let result: SyncResult | null = null

    try {
      switch (type) {
        case 'bexio':
          result = await syncBexio(
            companyId,
            connectorId,
            connector['credentials'] as Row,
            connector['last_synced_at'] as string | null,
          )
          break
        // Other connector types can be added here:
        // case '3cx': result = await sync3CX(...); break
        // case 'reonic': result = await syncReonic(...); break
        default:
          console.log(`[connector-sync] No cron sync for type: ${type}`)
          skipped++
          continue
      }

      if (result) {
        await writeSyncResult(connectorId, companyId, startedAt, result)
        results.push({
          type, companyId, success: result.success,
          records: result.recordsWritten, duration: result.durationMs,
        })
        synced++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await writeSyncResult(connectorId, companyId, startedAt, {
        success: false, recordsWritten: 0, errors: [{ code: 'CRON_SYNC_ERROR', message: msg, context: {} }],
      })
      results.push({ type, companyId, success: false, records: 0, duration: Date.now() - startedAt.getTime() })
      synced++
    }
  }

  console.log(`[connector-sync] Done: ${synced} synced, ${skipped} skipped`)

  return NextResponse.json({
    success: true,
    synced,
    skipped,
    results,
  })
}
