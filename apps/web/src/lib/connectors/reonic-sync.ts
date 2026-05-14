/**
 * Self-contained Reonic sync logic.
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

export interface ReonicSyncResult {
  success: boolean
  recordsFetched: number
  recordsWritten: number
  errors: SyncError[]
  durationMs: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REONIC_BASE_URL = 'https://api.reonic.de/rest/v2'
const RATE_LIMIT_DELAY_MS = 300
const PAGE_SIZE = 100

// ---------------------------------------------------------------------------
// Status / role mapping helpers
// ---------------------------------------------------------------------------

const LEAD_STATUS_MAP: Record<string, string> = {
  new: 'new', neu: 'new',
  contacted: 'contacted', kontaktiert: 'contacted',
  qualified: 'qualified', qualifiziert: 'qualified',
  appointment: 'appointment_set', appointment_set: 'appointment_set', termin: 'appointment_set',
  won: 'won', gewonnen: 'won',
  lost: 'lost', verloren: 'lost',
  invalid: 'invalid', ungueltig: 'invalid',
}

const LEAD_SOURCE_MAP: Record<string, string> = {
  website: 'website', referral: 'referral', empfehlung: 'referral',
  partner: 'partner', advertising: 'advertising', werbung: 'advertising',
  cold_call: 'cold_call', kaltakquise: 'cold_call', leadnotes: 'leadnotes',
}

const ROLE_TYPE_MAP: Record<string, string> = {
  setter: 'setter', berater: 'berater', advisor: 'berater', consultant: 'berater',
  innendienst: 'innendienst', backoffice: 'innendienst', bau: 'bau', montage: 'bau',
  teamleiter: 'teamleiter', team_lead: 'teamleiter',
  geschaeftsfuehrung: 'geschaeftsfuehrung', management: 'geschaeftsfuehrung',
  buchhaltung: 'buchhaltung', accounting: 'buchhaltung',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function mapLeadStatus(raw: string | null | undefined): string {
  if (!raw) return 'new'
  return LEAD_STATUS_MAP[raw.toLowerCase()] ?? 'new'
}

function mapLeadSource(raw: string | null | undefined): string {
  if (!raw) return 'other'
  return LEAD_SOURCE_MAP[raw.toLowerCase()] ?? 'other'
}

function mapRoleType(raw: string | null | undefined): string {
  if (!raw) return 'other'
  return ROLE_TYPE_MAP[raw.toLowerCase()] ?? raw.toLowerCase()
}

function deriveOfferStatus(state: string | null | undefined, type: string | null | undefined): string {
  const s = (state ?? '').toLowerCase()
  const t = (type ?? '').toLowerCase()
  if (s === 'won' || s === 'gewonnen') return 'won'
  if (s === 'lost' || s === 'verloren') return 'lost'
  if (t === 'offer' || t === 'installation') return 'sent'
  if (s === 'open' || s === 'request') return 'draft'
  if (s === 'closed') return 'won'
  return 'draft'
}

// ---------------------------------------------------------------------------
// Reonic API helpers
// ---------------------------------------------------------------------------

type PagedResponse<T> = { content: T[]; totalPages: number; totalElements: number }
type ResultsResponse<T> = { results: T[]; hasNextPage?: boolean; totalPages?: number }

function unwrapPaged<T>(
  raw: T[] | PagedResponse<T> | ResultsResponse<T>,
): { data: T[]; totalPages: number; hasNextPage?: boolean } {
  if (Array.isArray(raw)) return { data: raw, totalPages: 1 }
  if ('results' in raw) {
    const r = raw as ResultsResponse<T>
    return { data: r.results ?? [], totalPages: r.totalPages ?? 1, hasNextPage: r.hasNextPage }
  }
  const p = raw as PagedResponse<T>
  return { data: p.content ?? [], totalPages: p.totalPages ?? 1 }
}

async function reonicFetch<T>(
  apiKey: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${REONIC_BASE_URL}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'x-authorization': apiKey, Accept: 'application/json' },
  })
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After')
    await sleep(retry ? parseInt(retry, 10) * 1000 : 5000)
    return reonicFetch(apiKey, path, query)
  }
  if (!res.ok) {
    throw new Error(`Reonic ${res.status} for ${path}: ${await res.text()}`)
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
// Normalise functions
// ---------------------------------------------------------------------------

function normaliseUser(user: Row, companyId: string): Row {
  const firstName = (user['firstName'] ?? user['first_name'] ?? null) as string | null
  const lastName = (user['lastName'] ?? user['last_name'] ?? null) as string | null
  const roles = user['roles'] as string[] | null
  const roleRaw = (Array.isArray(roles) && roles.length > 0)
    ? roles[0]
    : (user['role'] as string | null)
  const isActive = user['isActive'] ?? user['active'] ?? true

  return {
    company_id: companyId,
    external_id: String(user['id']),
    first_name: firstName,
    last_name: lastName,
    email: (user['email'] as string) ?? null,
    role_type: mapRoleType(roleRaw ?? undefined),
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }
}

function normaliseLead(
  lead: Row,
  companyId: string,
  memberMap: Map<string, string>,
): Row {
  const now = new Date().toISOString()
  const createdAt = (lead['createdAt'] ?? lead['created_at'] ?? now) as string
  const updatedAt = (lead['updatedAt'] ?? lead['updated_at'] ?? now) as string
  const firstName = (lead['firstName'] ?? lead['first_name'] ?? null) as string | null
  const lastName = (lead['lastName'] ?? lead['last_name'] ?? null) as string | null
  const phone = (lead['telephone'] ?? lead['mobilePhone'] ?? lead['phone'] ?? lead['phoneNumber'] ?? null) as string | null

  const streetNumber = (lead['number'] ?? lead['streetNumber'] ?? lead['houseNumber'] ?? null) as string | null
  const streetName = lead['street'] as string | null
  const street = streetName
    ? (streetNumber ? `${streetName} ${streetNumber}` : streetName)
    : null
  const zip = (lead['postcode'] ?? lead['zip'] ?? null) as string | null

  // Assignment: assignedUserId (v2) or assigned_to (legacy)
  const assignedExtId = lead['assignedUserId'] ?? lead['assigned_to'] ?? null
  const setterId = assignedExtId ? (memberMap.get(String(assignedExtId)) ?? null) : null

  return {
    company_id: companyId,
    external_id: String(lead['id']),
    first_name: firstName,
    last_name: lastName,
    email: (lead['email'] as string) ?? null,
    phone,
    address_street: street,
    address_zip: zip,
    address_city: (lead['city'] as string) ?? null,
    address_canton: (lead['canton'] as string) ?? null,
    status: mapLeadStatus(lead['status'] as string),
    source: mapLeadSource(lead['source'] as string),
    setter_id: setterId,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function normaliseOffer(
  offer: Row,
  companyId: string,
  memberMap: Map<string, string>,
  leadMap: Map<string, string>,
): Row {
  const now = new Date().toISOString()
  const createdAt = (offer['requestCreatedAt'] ?? offer['createdAt'] ?? offer['created_at'] ?? now) as string
  const updatedAt = (offer['offerLastEditedAt'] ?? offer['updatedAt'] ?? offer['updated_at'] ?? now) as string
  const refNr = (offer['referenceNr'] ?? offer['reference_nr'] ?? null) as string | null
  const title = (offer['title'] ?? offer['name'] ?? (refNr ? `Angebot ${refNr}` : 'Angebot')) as string

  const customDealValue = offer['customDealValue'] as number | null
  const totalPlannedPrice = offer['totalPlannedPrice'] as number | null
  const value = offer['value'] as number | null
  const totalPrice = offer['totalPrice'] as number | null
  const amount =
    (customDealValue && customDealValue > 0 ? customDealValue : null) ??
    (totalPlannedPrice && totalPlannedPrice > 0 ? totalPlannedPrice : null) ??
    (value && value > 0 ? value : null) ??
    totalPrice ?? 0

  const beraterExtId = (offer['assignedToId'] ?? offer['assignedUserId'] ?? offer['berater_id'] ?? null) as string | null
  const beraterId = beraterExtId ? (memberMap.get(String(beraterExtId)) ?? null) : null

  const customer = offer['customer'] as { id: string } | null
  const contactExtId = (customer?.id ?? offer['contactId'] ?? offer['lead_id'] ?? null) as string | null
  const leadId = contactExtId ? (leadMap.get(String(contactExtId)) ?? null) : null

  return {
    company_id: companyId,
    external_id: String(offer['id']),
    lead_id: leadId,
    berater_id: beraterId,
    title,
    description: refNr ? `Ref: ${refNr}` : null,
    amount_chf: amount,
    status: deriveOfferStatus(offer['state'] as string, offer['type'] as string),
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

// ---------------------------------------------------------------------------
// Main Reonic sync function
// ---------------------------------------------------------------------------

export async function syncReonic(
  companyId: string,
  credentials: Row,
  lastSyncedAt: string | null,
): Promise<ReonicSyncResult> {
  const start = Date.now()
  const errors: SyncError[] = []
  let fetched = 0
  let written = 0

  const apiKey = (credentials['apiKey'] ?? credentials['api_key']) as string
  const clientId = (credentials['clientId'] ?? credentials['client_id']) as string

  if (!apiKey || !clientId) {
    return {
      success: false, recordsFetched: 0, recordsWritten: 0,
      errors: [{ code: 'NO_CREDENTIALS', message: 'apiKey or clientId missing in credentials', context: {} }],
      durationMs: Date.now() - start,
    }
  }

  try {
    // -----------------------------------------------------------------
    // 1. Sync users -> team_members
    // -----------------------------------------------------------------
    const rawUsers = await reonicFetch<Row[] | PagedResponse<Row>>(
      apiKey,
      `/clients/${clientId}/users`,
    )
    const users = Array.isArray(rawUsers) ? rawUsers : ((rawUsers as PagedResponse<Row>).content ?? [])

    if (users.length > 0) {
      const normUsers = users.map((u) => normaliseUser(u, companyId))
      fetched += normUsers.length
      const ur = await upsertRecords('team_members', normUsers, ['company_id', 'external_id'])
      written += ur.written
      errors.push(...ur.errors)
    }

    // Build memberMap: external_id -> internal UUID
    const db = createSupabaseServiceClient()
    const { data: members } = await db
      .from('team_members')
      .select('id, external_id')
      .eq('company_id', companyId)

    const memberMap = new Map<string, string>(
      (members ?? []).map((m: Row) => [m['external_id'] as string, m['id'] as string]),
    )

    // -----------------------------------------------------------------
    // 2. Sync leads (paginated, incremental via updated_from)
    // -----------------------------------------------------------------
    let page = 0
    let hasMoreLeads = true

    while (hasMoreLeads) {
      try {
        const query: Record<string, string> = {
          page: String(page),
          size: String(PAGE_SIZE),
        }
        if (lastSyncedAt) query['updated_from'] = lastSyncedAt

        const raw = await reonicFetch<Row[] | PagedResponse<Row>>(
          apiKey,
          `/clients/${clientId}/contacts`,
          query,
        )
        const { data: leads, totalPages } = unwrapPaged(raw as Row[] | PagedResponse<Row>)

        if (leads.length === 0) { hasMoreLeads = false; break }

        const normLeads = leads.map((l) => normaliseLead(l, companyId, memberMap))
        fetched += normLeads.length
        const lr = await upsertRecords('leads', normLeads, ['company_id', 'external_id'])
        written += lr.written
        errors.push(...lr.errors)

        if (page + 1 >= totalPages) hasMoreLeads = false
        else page++
        await sleep(RATE_LIMIT_DELAY_MS)
      } catch (err) {
        errors.push({
          code: 'REONIC_FETCH_LEADS',
          message: err instanceof Error ? err.message : String(err),
          context: { page },
        })
        hasMoreLeads = false
      }
    }

    // Build leadMap: external_id -> internal UUID
    const { data: dbLeads } = await db
      .from('leads')
      .select('id, external_id')
      .eq('company_id', companyId)

    const leadMap = new Map<string, string>(
      (dbLeads ?? []).map((l: Row) => [l['external_id'] as string, l['id'] as string]),
    )

    // -----------------------------------------------------------------
    // 3. Sync offers (paginated via h360/offers)
    //    h360/offers only accepts `page` (0-indexed, 100 per page).
    //    Response: { results: [...], hasNextPage: boolean }
    // -----------------------------------------------------------------
    page = 0
    let hasMoreOffers = true

    while (hasMoreOffers) {
      try {
        const query: Record<string, string> = { page: String(page) }
        const raw = await reonicFetch<ResultsResponse<Row>>(
          apiKey,
          `/clients/${clientId}/h360/offers`,
          query,
        )
        const { data: offers, hasNextPage } = unwrapPaged(
          raw as Row[] | PagedResponse<Row> | ResultsResponse<Row>,
        )

        if (offers.length === 0) { hasMoreOffers = false; break }

        const normOffers = offers.map((o) => normaliseOffer(o, companyId, memberMap, leadMap))
        fetched += normOffers.length
        const or = await upsertRecords('offers', normOffers, ['company_id', 'external_id'])
        written += or.written
        errors.push(...or.errors)

        if (!hasNextPage || offers.length === 0) hasMoreOffers = false
        else page++
        await sleep(RATE_LIMIT_DELAY_MS)
      } catch (err) {
        errors.push({
          code: 'REONIC_FETCH_OFFERS',
          message: err instanceof Error ? err.message : String(err),
          context: { page },
        })
        hasMoreOffers = false
      }
    }

    // -----------------------------------------------------------------
    // 4. Back-propagate assignment from offers to leads
    //    The Reonic contacts API does NOT return assignedUserId.
    //    Assignment info lives on offers (assignedToId + customer.id).
    //    After syncing offers we update each lead's setter_id using the
    //    most recent offer linked to that lead.
    // -----------------------------------------------------------------
    try {
      const { data: assignableOffers } = await db
        .from('offers')
        .select('lead_id, berater_id')
        .eq('company_id', companyId)
        .not('lead_id', 'is', null)
        .not('berater_id', 'is', null)
        .order('created_at', { ascending: false })

      // Build map: lead_id -> berater_id (first = most recent due to order)
      const leadAssignment = new Map<string, string>()
      for (const o of (assignableOffers ?? []) as Row[]) {
        const lid = o['lead_id'] as string
        if (!leadAssignment.has(lid)) {
          leadAssignment.set(lid, o['berater_id'] as string)
        }
      }

      // Update leads that have no setter_id (or update all for consistency)
      let assignedCount = 0
      for (const [leadId, beraterId] of leadAssignment) {
        const { error: updateErr } = await db
          .from('leads')
          .update({ setter_id: beraterId })
          .eq('id', leadId)
          .eq('company_id', companyId)

        if (updateErr) {
          errors.push({
            code: 'LEAD_ASSIGN_ERROR',
            message: updateErr.message,
            context: { leadId },
          })
        } else {
          assignedCount++
        }
      }

      if (assignedCount > 0) {
        console.log(`[reonic-sync] Assigned ${assignedCount} leads from offer data`)
      }
    } catch (err) {
      errors.push({
        code: 'LEAD_ASSIGN_ERROR',
        message: err instanceof Error ? err.message : String(err),
        context: {},
      })
    }
  } catch (err) {
    errors.push({
      code: 'REONIC_SYNC_FATAL',
      message: err instanceof Error ? err.message : String(err),
      context: {},
    })
  }

  const criticalErrors = errors.filter((e) => e.code === 'REONIC_SYNC_FATAL')

  return {
    success: criticalErrors.length === 0,
    recordsFetched: fetched,
    recordsWritten: written,
    errors,
    durationMs: Date.now() - start,
  }
}
