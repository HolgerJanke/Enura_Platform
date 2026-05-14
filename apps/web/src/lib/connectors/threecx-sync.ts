/**
 * Self-contained 3CX sync logic.
 * Used by both the cron job and the manual "Jetzt synchronisieren" button.
 * No cross-package imports -- uses fetch + @supabase/supabase-js only.
 *
 * NOTE: Recording file downloads are skipped in this web-side version to stay
 * within Vercel function timeout limits. Call metadata is still synced.
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

export interface ThreeCXSyncResult {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function defaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// 3CX API client (inline, self-contained)
// ---------------------------------------------------------------------------

interface TokenState {
  accessToken: string
  tokenType: string
  expiresAt: number
}

async function authenticate(
  baseUrl: string,
  username: string,
  password: string,
): Promise<TokenState> {
  const url = `${baseUrl}/webclient/api/Login/GetAccessToken`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username: username, Password: password }),
  })
  if (!res.ok) {
    throw new Error(`3CX auth failed: ${res.status} ${res.statusText}`)
  }
  const data = await res.json() as Row
  if (data['Status'] !== 'AuthSuccess' || !data['Token']) {
    throw new Error(`3CX auth: ${data['Status']} (no token)`)
  }
  const token = data['Token'] as Row
  return {
    accessToken: token['access_token'] as string,
    tokenType: (token['token_type'] as string) || 'Bearer',
    expiresAt: Date.now() + (((token['expires_in'] as number) ?? 600) - 10) * 1000,
  }
}

async function threecxFetch<T>(
  baseUrl: string,
  token: TokenState,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${baseUrl}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `${token.tokenType} ${token.accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`3CX API ${res.status}: ${res.statusText} - ${body}`)
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// OData response types
// ---------------------------------------------------------------------------

interface ODataResponse<T> {
  '@odata.count'?: number
  value: T[]
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

function mapDirection(callType: string): string {
  if (callType === 'InboundExternal') return 'inbound'
  return 'outbound'
}

function normaliseExtension(user: Row, companyId: string): Row {
  return {
    company_id: companyId,
    external_id: `3cx-ext-${user['Id']}`,
    first_name: user['FirstName'] as string,
    last_name: user['LastName'] as string,
    email: (user['EmailAddress'] as string) ?? null,
    phone: user['Number'] as string,
    role_type: 'setter',
    is_active: true,
    updated_at: new Date().toISOString(),
  }
}

function normaliseRecording(
  rec: Row,
  companyId: string,
  extensionMemberMap: Map<string, string>,
): Row {
  const ext = (rec['FromDn'] ?? rec['ToDn'] ?? null) as string | null
  const teamMemberId = ext ? (extensionMemberMap.get(ext) ?? null) : null
  const startMs = new Date(rec['StartTime'] as string).getTime()
  const endMs = rec['EndTime'] ? new Date(rec['EndTime'] as string).getTime() : startMs
  const durationSeconds = Math.round((endMs - startMs) / 1000)
  const isInbound = rec['CallType'] === 'InboundExternal'

  return {
    company_id: companyId,
    external_id: `3cx-rec-${rec['Id']}`,
    team_member_id: teamMemberId,
    direction: mapDirection(rec['CallType'] as string),
    status: 'answered',
    caller_number: isInbound ? (rec['FromCallerNumber'] as string) : (rec['FromCallerNumber'] as string) ?? null,
    callee_number: (rec['ToCallerNumber'] as string) ?? null,
    duration_seconds: durationSeconds,
    started_at: rec['StartTime'] as string,
    ended_at: (rec['EndTime'] as string) ?? null,
    created_at: rec['StartTime'] as string,
  }
}

// ---------------------------------------------------------------------------
// Main 3CX sync function
// ---------------------------------------------------------------------------

export async function syncThreeCX(
  companyId: string,
  credentials: Row,
  lastSyncedAt: string | null,
): Promise<ThreeCXSyncResult> {
  const start = Date.now()
  const errors: SyncError[] = []
  let fetched = 0
  let written = 0

  const apiUrl = (credentials['apiUrl'] ?? credentials['api_url']) as string
  const username = credentials['username'] as string
  const password = credentials['password'] as string

  if (!apiUrl || !username || !password) {
    return {
      success: false, recordsFetched: 0, recordsWritten: 0,
      errors: [{ code: 'NO_CREDENTIALS', message: 'apiUrl, username or password missing in credentials', context: {} }],
      durationMs: Date.now() - start,
    }
  }

  const baseUrl = apiUrl.replace(/\/+$/, '')

  try {
    const token = await authenticate(baseUrl, username, password)

    // -----------------------------------------------------------------
    // 1. Sync extensions (Users) -> team_members
    // -----------------------------------------------------------------
    const usersResp = await threecxFetch<ODataResponse<Row>>(baseUrl, token, '/xapi/v1/Users')
    const extensions = usersResp.value ?? []

    if (extensions.length > 0) {
      const normExt = extensions.map((ext) => normaliseExtension(ext, companyId))
      fetched += normExt.length
      const er = await upsertRecords('team_members', normExt, ['company_id', 'external_id'])
      written += er.written
      errors.push(...er.errors)
    }

    // Build extension-number -> team_member.id map
    const db = createSupabaseServiceClient()
    const { data: members } = await db
      .from('team_members')
      .select('id, external_id, phone')
      .eq('company_id', companyId)

    const extensionMemberMap = new Map<string, string>()
    for (const m of members ?? []) {
      const member = m as { id: string; external_id: string | null; phone: string | null }
      if (member.phone) extensionMemberMap.set(member.phone, member.id)
      if (member.external_id) extensionMemberMap.set(member.external_id, member.id)
    }

    // -----------------------------------------------------------------
    // 2. Sync recordings -> calls (paginated via OData)
    // -----------------------------------------------------------------
    const syncSince = lastSyncedAt ?? defaultStartDate()
    let skip = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const query: Record<string, string> = {
          $top: String(PAGE_SIZE),
          $skip: String(skip),
          $count: 'true',
          $orderby: 'StartTime desc',
          $filter: `StartTime ge ${syncSince}`,
        }

        const resp = await threecxFetch<ODataResponse<Row>>(
          baseUrl,
          token,
          '/xapi/v1/Recordings',
          query,
        )
        const recordings = resp.value ?? []
        const totalCount = resp['@odata.count'] ?? recordings.length

        if (recordings.length === 0) break

        const normCalls = recordings.map((rec) =>
          normaliseRecording(rec, companyId, extensionMemberMap),
        )
        fetched += normCalls.length
        const cr = await upsertRecords('calls', normCalls, ['company_id', 'external_id'])
        written += cr.written
        errors.push(...cr.errors)

        if (skip + PAGE_SIZE >= totalCount || recordings.length < PAGE_SIZE) break
        skip += PAGE_SIZE
        await sleep(RATE_LIMIT_DELAY_MS)
      } catch (err) {
        errors.push({
          code: '3CX_FETCH_RECORDINGS',
          message: err instanceof Error ? err.message : String(err),
          context: { skip },
        })
        break
      }
    }
  } catch (err) {
    errors.push({
      code: '3CX_SYNC_FATAL',
      message: err instanceof Error ? err.message : String(err),
      context: {},
    })
  }

  const criticalErrors = errors.filter((e) => e.code === '3CX_SYNC_FATAL')

  return {
    success: criticalErrors.length === 0,
    recordsFetched: fetched,
    recordsWritten: written,
    errors,
    durationMs: Date.now() - start,
  }
}
