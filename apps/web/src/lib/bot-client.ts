/**
 * Client for the Enura Bot API (enura-bots).
 * Talks to the Hono REST API running at BOT_API_URL.
 */

const BOT_API_URL = process.env.ENURA_BOTS_API_URL ?? 'http://localhost:4000'
const BOT_API_KEY = process.env.ENURA_BOTS_API_KEY ?? ''

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BotManifestInfo = {
  id: string
  name: string
  description: string
  tier: string
  version: string
  requiredConnectors: string[]
  optionalConnectors?: string[]
}

export type BotStatusInfo = {
  botId: string
  queueDepth: number
}

export type BotRunResult = {
  jobId: string
  botId: string
  status: 'completed' | 'failed'
  output?: Record<string, unknown>
  error?: string
  startedAt: string
  completedAt: string
  durationMs?: number
}

export type BotTriggerResult = {
  jobId: string
  botId: string
  status: 'queued'
}

export type BotHealthInfo = {
  status: string
  bots: number
  version: string
  timestamp?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  if (BOT_API_KEY) h['X-API-Key'] = BOT_API_KEY
  return h
}

async function botFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BOT_API_URL}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    // Don't cache bot API responses in Next.js
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Bot API ${res.status}: ${body || res.statusText}`)
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Health check — GET /health */
export async function getBotHealth(): Promise<BotHealthInfo> {
  return botFetch<BotHealthInfo>('/health')
}

// API response wrapper from Hono
type ApiResponse<T> = { ok: boolean; data: T; error?: string }

/** List all registered bots — GET /api/bots */
export async function listBots(): Promise<BotManifestInfo[]> {
  const res = await botFetch<ApiResponse<BotManifestInfo[]>>('/api/bots')
  return res.data
}

/** Get a single bot's manifest — GET /api/bots/:id */
export async function getBot(botId: string): Promise<BotManifestInfo> {
  const res = await botFetch<ApiResponse<BotManifestInfo>>(`/api/bots/${botId}`)
  return res.data
}

/** Get queue depth — GET /api/bots/:id/status */
export async function getBotStatus(botId: string): Promise<BotStatusInfo> {
  const res = await botFetch<ApiResponse<BotStatusInfo>>(`/api/bots/${botId}/status`)
  return res.data
}

/** Trigger a bot async (via queue) — POST /api/bots/:id/trigger */
export async function triggerBot(
  botId: string,
  payload: { companyId: string; input: Record<string, unknown> },
): Promise<BotTriggerResult> {
  const res = await botFetch<ApiResponse<BotTriggerResult>>(`/api/bots/${botId}/trigger`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

/** Run a bot synchronously — POST /api/bots/:id/run */
export async function runBot(
  botId: string,
  payload: { companyId: string; input: Record<string, unknown> },
): Promise<BotRunResult> {
  const res = await botFetch<ApiResponse<BotRunResult>>(`/api/bots/${botId}/run`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

/**
 * Safe wrapper: try to fetch bots, return empty array if API is down.
 * Useful for dashboard widgets that shouldn't break the whole page.
 */
export async function listBotsSafe(): Promise<BotManifestInfo[]> {
  try {
    return await listBots()
  } catch {
    return []
  }
}

/** Safe health check — returns null if unreachable */
export async function getBotHealthSafe(): Promise<BotHealthInfo | null> {
  try {
    return await getBotHealth()
  } catch {
    return null
  }
}
