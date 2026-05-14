/**
 * Self-contained LeadNotes sync logic.
 * Used by both the cron job and the manual "Jetzt synchronisieren" button.
 * No cross-package imports -- uses fetch + @supabase/supabase-js only.
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

export interface LeadnotesSyncResult {
  success: boolean
  recordsFetched: number
  recordsWritten: number
  errors: SyncError[]
  durationMs: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100
const RATE_LIMIT_DELAY_MS = 300
const DEFAULT_BASE_URL = 'https://leads.alpen-energie.ch'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// LeadNotes API helper
// ---------------------------------------------------------------------------

interface LeadnotesApiResponse {
  data: Row[]
  meta: {
    total: number
    current_page: number
    per_page: number
    last_page: number
  }
}

async function fetchLeadnotesPage(
  apiKey: string,
  baseUrl: string,
  opts: { page: number; perPage: number; createdAfter?: string },
): Promise<LeadnotesApiResponse> {
  const url = new URL('/api/v2/leads', baseUrl)
  url.searchParams.set('page', String(opts.page))
  url.searchParams.set('per_page', String(opts.perPage))
  if (opts.createdAfter) url.searchParams.set('created_after', opts.createdAfter)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  })

  if (res.status === 429) {
    const retry = res.headers.get('Retry-After')
    await sleep(retry ? parseInt(retry, 10) * 1000 : 5000)
    return fetchLeadnotesPage(apiKey, baseUrl, opts)
  }

  if (!res.ok) {
    throw new Error(`Leadnotes API ${res.status}: ${await res.text()}`)
  }

  return (await res.json()) as LeadnotesApiResponse
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
// Lead source / status mapping
// ---------------------------------------------------------------------------

function mapLeadSource(source: string): string {
  const s = source.toLowerCase()
  if (s.includes('website') || s.includes('web') || s.includes('online')) return 'website'
  if (s.includes('referral') || s.includes('empfehlung')) return 'referral'
  if (s.includes('partner')) return 'partner'
  if (s.includes('ad') || s.includes('werbung') || s.includes('facebook') || s.includes('google')) return 'advertising'
  if (s.includes('cold') || s.includes('kalt')) return 'cold_call'
  return 'leadnotes'
}

function mapLeadStatus(status: string | null | undefined): string {
  if (!status) return 'new'
  const s = status.toLowerCase()
  if (s === 'approved' || s === 'accepted') return 'qualified'
  if (s === 'pending' || s === 'new') return 'new'
  if (s === 'rejected' || s === 'declined') return 'lost'
  if (s === 'delivered') return 'contacted'
  return 'new'
}

// ---------------------------------------------------------------------------
// Normalise
// ---------------------------------------------------------------------------

function normaliseLead(companyId: string, lead: Row): Row {
  const customData = lead['custom_data'] as Row | null
  const herkunft = (customData?.['herkunft'] as string) ?? ''
  const source = herkunft ? mapLeadSource(herkunft) : 'leadnotes'

  const parts: string[] = ['[Leadnotes]']
  if (herkunft) parts.push(`Herkunft: ${herkunft}`)
  if (lead['company']) parts.push(`Firma: ${lead['company'] as string}`)
  const notes = parts.length > 1 ? parts.join('\n') : null

  return {
    company_id: companyId,
    external_id: String(lead['id']),
    first_name: (lead['first_name'] as string) ?? null,
    last_name: (lead['last_name'] as string) ?? null,
    email: (lead['email'] as string) ?? null,
    phone: (lead['phone'] as string) ?? null,
    address_street: (lead['street_no'] as string) ?? null,
    address_zip: (lead['zip_code'] as string) ?? null,
    address_city: (lead['city'] as string) ?? null,
    source,
    status: mapLeadStatus(lead['status'] as string),
    notes,
    created_at: lead['created_at'] as string,
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function normalisePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, '')
}

async function deduplicateLeads(
  companyId: string,
  leads: Row[],
): Promise<{ newLeads: Row[]; duplicateCount: number }> {
  if (leads.length === 0) return { newLeads: [], duplicateCount: 0 }

  const db = createSupabaseServiceClient()

  const emails = leads
    .map((l) => l['email'] as string)
    .filter((e) => e && e.length > 0)
  const phones = leads
    .map((l) => l['phone'] as string)
    .filter((p) => p && p.length > 0)
  const externalIds = leads.map((l) => String(l['id']))

  // Check existing by external_id
  const existingByExtId = new Set<string>()
  if (externalIds.length > 0) {
    const { data: extMatches } = await db
      .from('leads')
      .select('external_id')
      .eq('company_id', companyId)
      .in('external_id', externalIds)
    for (const m of extMatches ?? []) {
      if ((m as Row)['external_id']) existingByExtId.add((m as Row)['external_id'] as string)
    }
  }

  // Check existing by email
  const existingEmails = new Set<string>()
  if (emails.length > 0) {
    const { data: emailMatches } = await db
      .from('leads')
      .select('email')
      .eq('company_id', companyId)
      .in('email', emails)
    for (const m of emailMatches ?? []) {
      if ((m as Row)['email']) existingEmails.add(((m as Row)['email'] as string).toLowerCase())
    }
  }

  // Check existing by phone
  const existingPhones = new Set<string>()
  if (phones.length > 0) {
    const { data: phoneMatches } = await db
      .from('leads')
      .select('phone')
      .eq('company_id', companyId)
      .in('phone', phones)
    for (const m of phoneMatches ?? []) {
      if ((m as Row)['phone']) existingPhones.add(normalisePhone((m as Row)['phone'] as string))
    }
  }

  const newLeads: Row[] = []
  let duplicateCount = 0

  for (const lead of leads) {
    if (existingByExtId.has(String(lead['id']))) { duplicateCount++; continue }
    const email = lead['email'] as string
    if (email && existingEmails.has(email.toLowerCase())) { duplicateCount++; continue }
    const phone = lead['phone'] as string
    if (phone && existingPhones.has(normalisePhone(phone))) { duplicateCount++; continue }
    newLeads.push(lead)
  }

  return { newLeads, duplicateCount }
}

// ---------------------------------------------------------------------------
// Main LeadNotes sync function
// ---------------------------------------------------------------------------

export async function syncLeadnotes(
  companyId: string,
  credentials: Row,
  lastSyncedAt: string | null,
): Promise<LeadnotesSyncResult> {
  const start = Date.now()
  const errors: SyncError[] = []
  let fetched = 0
  let written = 0

  const apiKey = (credentials['apiKey'] ?? credentials['api_key']) as string
  const baseUrl = ((credentials['baseUrl'] ?? credentials['base_url']) as string) || DEFAULT_BASE_URL

  if (!apiKey) {
    return {
      success: false, recordsFetched: 0, recordsWritten: 0,
      errors: [{ code: 'NO_CREDENTIALS', message: 'apiKey missing in credentials', context: {} }],
      durationMs: Date.now() - start,
    }
  }

  try {
    // Fetch all leads since last sync (paginated)
    const allLeads: Row[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        const resp = await fetchLeadnotesPage(apiKey, baseUrl, {
          page,
          perPage: PAGE_SIZE,
          createdAfter: lastSyncedAt ?? undefined,
        })
        allLeads.push(...resp.data)
        fetched += resp.data.length
        hasMore = resp.meta.current_page < resp.meta.last_page
        page++
        await sleep(RATE_LIMIT_DELAY_MS)
      } catch (err) {
        errors.push({
          code: 'LEADNOTES_FETCH',
          message: err instanceof Error ? err.message : String(err),
          context: { page },
        })
        hasMore = false
      }
    }

    if (allLeads.length === 0) {
      return {
        success: true, recordsFetched: 0, recordsWritten: 0, errors: [],
        durationMs: Date.now() - start,
      }
    }

    // Deduplicate against existing leads
    const { newLeads, duplicateCount } = await deduplicateLeads(companyId, allLeads)

    if (newLeads.length > 0) {
      const normalised = newLeads.map((lead) => normaliseLead(companyId, lead))
      const result = await upsertRecords('leads', normalised, ['company_id', 'external_id'])
      written = result.written
      errors.push(...result.errors)
    }

    if (duplicateCount > 0) {
      console.log(`[leadnotes-sync] Skipped ${duplicateCount} duplicate leads`)
    }
  } catch (err) {
    errors.push({
      code: 'LEADNOTES_SYNC_FATAL',
      message: err instanceof Error ? err.message : String(err),
      context: {},
    })
  }

  return {
    success: errors.filter((e) => e.code === 'LEADNOTES_SYNC_FATAL').length === 0,
    recordsFetched: fetched,
    recordsWritten: written,
    errors,
    durationMs: Date.now() - start,
  }
}
