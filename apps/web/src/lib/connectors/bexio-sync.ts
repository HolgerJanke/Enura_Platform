/**
 * Self-contained Bexio sync logic.
 * Used by both the cron job and the manual "Jetzt synchronisieren" button.
 * No cross-package imports — uses fetch + @supabase/supabase-js only.
 *
 * Syncs: contacts→suppliers, kb_invoice→invoices, kb_order→invoices_incoming,
 *        kb_bill→invoices_incoming, payments, and auto-matches invoices to projects.
 */
import { createSupabaseServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

export interface SyncError {
  code: string
  message: string
  context: Record<string, unknown>
}

export interface BexioSyncResult {
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

const BEXIO_ORDER_STATUS_MAP: Record<number, string> = {
  5: 'approved',   // Bestätigt
  6: 'received',   // Entwurf
  7: 'draft',      // Entwurf
  8: 'in_validation', // Offen/Versendet
  9: 'paid',       // Erledigt
  16: 'approved',  // Teilweise erledigt
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

function mapOrderStatus(statusId: number): string {
  return BEXIO_ORDER_STATUS_MAP[statusId] ?? 'received'
}

function computeDueDate(issuedAt: string): string {
  const d = new Date(issuedAt)
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

/**
 * Extract customer name from Bexio contact_address or contact map.
 * contact_address format: "Frau\nAnna Baumann\nStrasse 123\n4410 Ort\nSchweiz"
 * The name is typically on line 2 (after salutation).
 */
function extractCustomerName(
  item: Row,
  contactNameMap: Map<number, string>,
): string {
  const contactId = item['contact_id'] as number | null
  if (contactId && contactNameMap.has(contactId)) {
    return contactNameMap.get(contactId)!
  }
  const addr = item['contact_address'] as string | null
  if (addr) {
    const lines = addr.split('\n').map((l) => l.trim()).filter(Boolean)
    // Skip salutation (Frau/Herr/Firma) — name is usually on line 2
    if (lines.length >= 2) {
      const firstLine = lines[0]!.toLowerCase()
      if (firstLine === 'frau' || firstLine === 'herr' || firstLine === 'firma') {
        return lines[1]!
      }
      return lines[0]!
    }
    if (lines.length === 1) return lines[0]!
  }
  return contactId ? `Kontakt ${contactId}` : 'Unbekannt'
}

// ---------------------------------------------------------------------------
// Bexio API client
// ---------------------------------------------------------------------------

async function bexioFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${BEXIO_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After')
    await sleep(retry ? parseInt(retry, 10) * 1000 : 5000)
    return bexioFetch(token, path)
  }
  if (!res.ok) {
    throw new Error(`Bexio API error (${res.status}) for ${path}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

/** Paginate through a Bexio API endpoint with optional incremental cutoff. */
async function bexioPaginate(
  token: string,
  path: string,
  cutoff: number,
  errors: SyncError[],
  errorCode: string,
): Promise<Row[]> {
  const all: Row[] = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    try {
      const sep = path.includes('?') ? '&' : '?'
      const page = await bexioFetch<Row[]>(
        token,
        `${path}${sep}offset=${offset}&limit=${PAGE_SIZE}&order_by=updated_at&order=DESC`,
      )
      if (page.length === 0) break
      let reachedCutoff = false
      for (const item of page) {
        if (cutoff > 0 && new Date(item['updated_at'] as string).getTime() < cutoff) {
          reachedCutoff = true
          break
        }
        all.push(item)
      }
      if (reachedCutoff || page.length < PAGE_SIZE) hasMore = false
      else offset += PAGE_SIZE
      await sleep(RATE_LIMIT_DELAY_MS)
    } catch (err) {
      errors.push({
        code: errorCode,
        message: err instanceof Error ? err.message : String(err),
        context: { offset },
      })
      hasMore = false
    }
  }
  return all
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
// Write sync result + update connector status
// ---------------------------------------------------------------------------

export async function writeSyncResult(
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
// Invoice → Project auto-matching
// ---------------------------------------------------------------------------

async function matchInvoicesToProjects(
  companyId: string,
  contactNameMap: Map<number, string>,
  invoices: Row[],
  errors: SyncError[],
): Promise<number> {
  if (invoices.length === 0) return 0
  const db = createSupabaseServiceClient()
  let matched = 0

  // Load all projects with their lead info for matching
  const { data: projects } = await db
    .from('projects')
    .select('id, title, lead_id, leads!inner(first_name, last_name, email, phone, address_zip, address_city)')
    .eq('company_id', companyId)

  if (!projects || projects.length === 0) return 0

  // Build lookup maps from project leads
  const projectByEmail = new Map<string, string>()
  const projectByName = new Map<string, string>()
  const projectByLastName = new Map<string, string>()

  for (const p of projects as Row[]) {
    const pid = p['id'] as string
    const leads = p['leads'] as Row | null
    if (!leads) continue
    const email = (leads['email'] as string)?.toLowerCase()
    const firstName = (leads['first_name'] as string) ?? ''
    const lastName = (leads['last_name'] as string) ?? ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ').toLowerCase()
    if (email) projectByEmail.set(email, pid)
    if (fullName) projectByName.set(fullName, pid)
    if (lastName) projectByLastName.set(lastName.toLowerCase(), pid)
  }

  // Match unlinked invoices by contact name/email
  const { data: unlinked } = await db
    .from('invoices')
    .select('id, external_id, customer_name')
    .eq('company_id', companyId)
    .is('project_id', null)
    .not('external_id', 'is', null)

  const updates: Array<{ id: string; project_id: string }> = []

  for (const inv of (unlinked ?? []) as Row[]) {
    const name = ((inv['customer_name'] as string) ?? '').toLowerCase().trim()
    if (!name || name.startsWith('kontakt') || name === 'unbekannt') continue

    // Try exact full name match
    let pid = projectByName.get(name)
    // Try last name match
    if (!pid) {
      const parts = name.split(' ')
      const lastName = parts[parts.length - 1]
      if (lastName && lastName.length > 2) {
        pid = projectByLastName.get(lastName)
      }
    }
    if (pid) {
      updates.push({ id: inv['id'] as string, project_id: pid })
    }
  }

  // Batch-update matched invoices
  for (const upd of updates) {
    const { error } = await db
      .from('invoices')
      .update({ project_id: upd.project_id })
      .eq('id', upd.id)
      .is('project_id', null)
    if (!error) matched++
  }

  if (matched > 0) {
    console.log(`[bexio-sync] Matched ${matched} invoices to projects`)
  }

  return matched
}

// ---------------------------------------------------------------------------
// 5b. Auto-match incoming invoices (expenses) to projects by sender_name
// ---------------------------------------------------------------------------

async function matchExpensesToProjects(
  companyId: string,
  errors: SyncError[],
): Promise<number> {
  const db = createSupabaseServiceClient()
  let matched = 0

  // Load all projects with their lead info for matching
  const { data: projects } = await db
    .from('projects')
    .select('id, title, lead_id, leads!inner(first_name, last_name, email)')
    .eq('company_id', companyId)

  if (!projects || projects.length === 0) return 0

  // Build lookup maps from project leads
  const projectByName = new Map<string, string>()
  const projectByLastName = new Map<string, string>()

  for (const p of projects as Row[]) {
    const pid = p['id'] as string
    const leads = p['leads'] as Row | null
    if (!leads) continue
    const firstName = (leads['first_name'] as string) ?? ''
    const lastName = (leads['last_name'] as string) ?? ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ').toLowerCase()
    if (fullName) projectByName.set(fullName, pid)
    if (lastName) projectByLastName.set(lastName.toLowerCase(), pid)
  }

  // Match unlinked incoming invoices by sender_name
  const { data: unlinked } = await db
    .from('invoices_incoming')
    .select('id, sender_name')
    .eq('company_id', companyId)
    .is('project_id', null)
    .not('sender_name', 'is', null)

  const updates: Array<{ id: string; project_id: string }> = []

  for (const inv of (unlinked ?? []) as Row[]) {
    const name = ((inv['sender_name'] as string) ?? '').toLowerCase().trim()
    if (!name || name === 'unbekannt' || name === 'bexio kreditor') continue

    // Try exact full name match
    let pid = projectByName.get(name)
    // Try last name match
    if (!pid) {
      const parts = name.split(' ')
      const lastName = parts[parts.length - 1]
      if (lastName && lastName.length > 2) {
        pid = projectByLastName.get(lastName)
      }
    }
    if (pid) {
      updates.push({ id: inv['id'] as string, project_id: pid })
    }
  }

  // Batch-update matched expenses
  for (const upd of updates) {
    const { error } = await db
      .from('invoices_incoming')
      .update({ project_id: upd.project_id })
      .eq('id', upd.id)
      .is('project_id', null)
    if (!error) matched++
  }

  if (matched > 0) {
    console.log(`[bexio-sync] Matched ${matched} incoming invoices (expenses) to projects`)
  }

  return matched
}

// ---------------------------------------------------------------------------
// Main Bexio sync function
// ---------------------------------------------------------------------------

export async function syncBexio(
  companyId: string,
  credentials: Row,
  lastSyncedAt: string | null,
): Promise<BexioSyncResult> {
  const start = Date.now()
  const errors: SyncError[] = []
  let fetched = 0
  let written = 0

  const token = credentials['access_token'] as string
  if (!token) {
    return {
      success: false, recordsFetched: 0, recordsWritten: 0,
      errors: [{ code: 'NO_TOKEN', message: 'No access_token in credentials', context: {} }],
      durationMs: Date.now() - start,
    }
  }

  const cutoff = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0
  const db = createSupabaseServiceClient()

  // Get holding_id for this company (needed for invoices_incoming)
  const { data: companyRow } = await db.from('companies').select('holding_id').eq('id', companyId).single()
  const holdingId = (companyRow as Row | null)?.['holding_id'] as string ?? ''

  try {
    // ── 1. Contacts → suppliers (sync first to build contact name map) ──
    const contacts = await bexioPaginate(token, '/contact', 0, errors, 'BEXIO_FETCH_CONTACTS')
    fetched += contacts.length

    // Build contact name map: Bexio contact_id → display name
    const contactNameMap = new Map<number, string>()
    for (const c of contacts) {
      const cid = c['id'] as number
      const name = (c['contact_type_id'] as number) === 1
        ? ((c['name_1'] as string) ?? 'Unknown')
        : [c['name_2'], c['name_1']].filter(Boolean).join(' ') || 'Unknown'
      contactNameMap.set(cid, name)
    }

    if (contacts.length > 0) {
      const normContacts = contacts.map((c) => {
        const name = contactNameMap.get(c['id'] as number) ?? 'Unknown'
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
      errors.push(...cr.errors)
    }

    // ── 2. Invoices (incremental) ───────────────────────────────────
    const invoices = await bexioPaginate(token, '/kb_invoice', cutoff, errors, 'BEXIO_FETCH_INVOICES')
    fetched += invoices.length

    if (invoices.length > 0) {
      const normalised = invoices.map((inv) => ({
        company_id: companyId,
        external_id: String(inv['id']),
        invoice_number: (inv['document_nr'] as string) ?? `BEXIO-${inv['id']}`,
        customer_name: extractCustomerName(inv, contactNameMap),
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

      // 2b. Payments for synced invoices
      // Skip per-invoice payment fetching during full sync (500+ API calls would timeout).
      // Payments will be fetched on the next incremental sync.
      const isFullSync = cutoff === 0
      const invoicesToFetchPayments = isFullSync ? [] : invoices
      for (const inv of invoicesToFetchPayments) {
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

    // ── 3. Purchase orders (kb_order) → invoices_incoming (expenses) ─
    // This is the primary expense source when kb_bill returns 404
    try {
      const orders = await bexioPaginate(token, '/kb_order', cutoff, errors, 'BEXIO_FETCH_ORDERS')
      fetched += orders.length

      if (orders.length > 0) {
        const { data: suppliers } = await db.from('suppliers').select('id, external_id').eq('company_id', companyId)
        const supplierMap = new Map((suppliers ?? []).map((s: Row) => [s['external_id'] as string, s['id'] as string]))

        const normOrders = orders.map((o) => {
          const supplierId = o['contact_id'] ? (supplierMap.get(String(o['contact_id'])) ?? null) : null
          const senderName = extractCustomerName(o, contactNameMap)
          return {
            company_id: companyId,
            holding_id: holdingId,
            external_id: `order-${o['id']}`,
            invoice_number: (o['document_nr'] as string) ?? `BEXIO-ORDER-${o['id']}`,
            invoice_date: o['is_valid_from'],
            sender_name: senderName,
            supplier_id: supplierId,
            net_amount: parseFloat((o['total_net'] as string) ?? '0'),
            vat_amount: parseFloat((o['total_taxes'] as string) ?? '0'),
            gross_amount: parseFloat((o['total_gross'] as string) ?? '0'),
            currency: 'CHF',
            due_date: null,
            status: mapOrderStatus(o['kb_item_status_id'] as number),
            extraction_status: 'completed',
            incomer_type: 'webhook',
            raw_storage_path: `bexio/orders/${o['id']}`,
            raw_filename: `${(o['document_nr'] as string) ?? o['id']}.pdf`,
          }
        })
        const or = await upsertRecords('invoices_incoming', normOrders, ['company_id', 'external_id'])
        written += or.written
        errors.push(...or.errors)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Orders 404 is non-critical (module might not be available)
      if (!msg.includes('404')) {
        errors.push({ code: 'BEXIO_FETCH_ORDERS', message: msg, context: {} })
      }
    }

    // ── 4. Bills (Kreditoren) → invoices_incoming ───────────────────
    // 404 is expected if the Kreditoren module is not included in the Bexio plan
    try {
      const bills = await bexioPaginate(token, '/kb_bill', cutoff, errors, 'BEXIO_FETCH_BILLS')
      fetched += bills.length

      if (bills.length > 0) {
        const { data: suppliers } = await db.from('suppliers').select('id, external_id').eq('company_id', companyId)
        const supplierMap = new Map((suppliers ?? []).map((s: Row) => [s['external_id'] as string, s['id'] as string]))
        const normBills = bills.map((b) => {
          const supplierId = b['contact_id'] ? (supplierMap.get(String(b['contact_id'])) ?? null) : null
          return {
            company_id: companyId, holding_id: holdingId, external_id: `bill-${b['id']}`,
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
        errors.push(...br.errors)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ code: 'BEXIO_FETCH_BILLS', message: msg, context: {} })
    }

    // ── 5. Auto-match invoices to projects ──────────────────────────
    try {
      await matchInvoicesToProjects(companyId, contactNameMap, invoices, errors)
    } catch (err) {
      errors.push({
        code: 'BEXIO_MATCH_PROJECTS',
        message: err instanceof Error ? err.message : String(err),
        context: {},
      })
    }

    // ── 5b. Auto-match expenses (invoices_incoming) to projects ─────
    try {
      await matchExpensesToProjects(companyId, errors)
    } catch (err) {
      errors.push({
        code: 'BEXIO_MATCH_EXPENSES',
        message: err instanceof Error ? err.message : String(err),
        context: {},
      })
    }
  } catch (err) {
    errors.push({ code: 'BEXIO_SYNC_FATAL', message: err instanceof Error ? err.message : String(err), context: {} })
  }

  // Bills/orders 404 is expected — don't count as critical error
  const criticalErrors = errors.filter((e) => {
    if (e.code === 'BEXIO_FETCH_BILLS' && e.message.includes('404')) return false
    if (e.code === 'BEXIO_FETCH_ORDERS' && e.message.includes('404')) return false
    return true
  })

  return {
    success: criticalErrors.length === 0,
    recordsFetched: fetched,
    recordsWritten: written,
    errors,
    durationMs: Date.now() - start,
  }
}
