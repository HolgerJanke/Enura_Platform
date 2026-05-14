import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Manual anomaly scan — triggers the same detectors as the cron job
 * but can be called by authenticated admins.
 * POST /api/anomaly-scan
 */

type Row = Record<string, unknown>

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const sq = values.map((v) => (v - avg) ** 2)
  return Math.sqrt(sq.reduce((s, v) => s + v, 0) / (values.length - 1))
}

interface DetectedAnomaly {
  type: string
  severity: 'info' | 'warning' | 'critical'
  entity_id: string | null
  entity_name: string | null
  metric: string
  current_value: number
  baseline_value: number
  deviation_pct: number
  message: string
}

function anomalyKey(type: string, entityId: string | null): string {
  return `${type}::${entityId ?? 'global'}`
}

// ---------------------------------------------------------------------------
// Detectors (same logic as cron)
// ---------------------------------------------------------------------------

async function detectLeadIngestionStopped(
  db: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string,
): Promise<DetectedAnomaly[]> {
  const now = new Date()
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000)
  const sixteenHoursAgo = new Date(now.getTime() - 16 * 60 * 60 * 1000)

  const { count: recentCount } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', eightHoursAgo.toISOString())

  const { count: previousCount } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', sixteenHoursAgo.toISOString())
    .lt('created_at', eightHoursAgo.toISOString())

  if ((recentCount ?? 0) === 0 && (previousCount ?? 0) > 0) {
    return [{
      type: 'lead_ingestion_stopped',
      severity: 'critical',
      entity_id: null,
      entity_name: null,
      metric: 'leads_last_8h',
      current_value: 0,
      baseline_value: previousCount ?? 0,
      deviation_pct: -100,
      message: `Keine neuen Leads in den letzten 8 Stunden. Vorheriger Zeitraum: ${previousCount} Leads.`,
    }]
  }
  return []
}

async function detectConnectorSyncFailure(
  db: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const now = new Date()

  const { data: connectors } = await db
    .from('connectors')
    .select('id, type, display_name, sync_interval_minutes, last_synced_at, status')
    .eq('company_id', companyId)
    .eq('status', 'active')

  for (const c of (connectors ?? []) as Row[]) {
    const lastSynced = c['last_synced_at'] as string | null
    const interval = Number(c['sync_interval_minutes'] ?? 15)
    const name = (c['display_name'] as string) ?? (c['type'] as string)
    const connId = c['id'] as string

    if (!lastSynced) {
      anomalies.push({
        type: 'connector_sync_failure',
        severity: 'critical',
        entity_id: connId,
        entity_name: name,
        metric: 'sync_age_minutes',
        current_value: -1,
        baseline_value: interval,
        deviation_pct: 100,
        message: `Connector "${name}" wurde noch nie synchronisiert.`,
      })
      continue
    }

    const ageMin = (now.getTime() - new Date(lastSynced).getTime()) / 60_000
    if (ageMin > interval * 2) {
      anomalies.push({
        type: 'connector_sync_failure',
        severity: ageMin > interval * 4 ? 'critical' : 'warning',
        entity_id: connId,
        entity_name: name,
        metric: 'sync_age_minutes',
        current_value: Math.round(ageMin),
        baseline_value: interval,
        deviation_pct: Math.round(((ageMin - interval) / interval) * 100),
        message: `Connector "${name}" hat seit ${Math.round(ageMin)} Min. nicht synchronisiert (Intervall: ${interval} Min.).`,
      })
    }
  }
  return anomalies
}

async function detectOfferWinRateDrop(
  db: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const { count: recentWon } = await db
    .from('offers').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('status', 'won')
    .gte('updated_at', sevenDaysAgo.toISOString())

  const { count: recentLost } = await db
    .from('offers').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('status', 'lost')
    .gte('updated_at', sevenDaysAgo.toISOString())

  const { count: prevWon } = await db
    .from('offers').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('status', 'won')
    .gte('updated_at', thirtyDaysAgo.toISOString())
    .lt('updated_at', sevenDaysAgo.toISOString())

  const { count: prevLost } = await db
    .from('offers').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('status', 'lost')
    .gte('updated_at', thirtyDaysAgo.toISOString())
    .lt('updated_at', sevenDaysAgo.toISOString())

  const rWon = recentWon ?? 0
  const rLost = recentLost ?? 0
  const pWon = prevWon ?? 0
  const pLost = prevLost ?? 0
  const recentTotal = rWon + rLost
  const prevTotal = pWon + pLost

  if (recentTotal >= 3 && prevTotal >= 3) {
    const recentRate = rWon / recentTotal
    const prevRate = pWon / prevTotal
    const dropPct = (prevRate - recentRate) * 100
    if (dropPct >= 15) {
      anomalies.push({
        type: 'offer_win_rate_drop',
        severity: dropPct >= 25 ? 'critical' : 'warning',
        entity_id: null,
        entity_name: null,
        metric: 'win_rate_7d',
        current_value: Math.round(recentRate * 100),
        baseline_value: Math.round(prevRate * 100),
        deviation_pct: Math.round(-dropPct),
        message: `Abschlussquote gesunken: ${Math.round(recentRate * 100)}% (7 Tage) vs. ${Math.round(prevRate * 100)}% (30-Tage Baseline).`,
      })
    }
  }
  return anomalies
}

async function detectStalledProjects(
  db: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data: stalled } = await db
    .from('projects')
    .select('id, title, current_step_name, phase_entered_at')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .lt('phase_entered_at', fourteenDaysAgo.toISOString())
    .limit(50)

  const stalledList = (stalled ?? []) as Row[]
  if (stalledList.length > 0) {
    anomalies.push({
      type: 'stalled_projects',
      severity: stalledList.length >= 10 ? 'critical' : 'warning',
      entity_id: null,
      entity_name: null,
      metric: 'stalled_project_count',
      current_value: stalledList.length,
      baseline_value: 0,
      deviation_pct: 100,
      message: `${stalledList.length} Projekte stagnieren seit ueber 14 Tagen in der gleichen Phase.`,
    })
  }
  return anomalies
}

async function detectRevenueAnomaly(
  db: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const now = new Date()

  // Get monthly won revenue for the last 6 months
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: wonOffers } = await db
    .from('offers')
    .select('amount_chf, created_at')
    .eq('company_id', companyId)
    .eq('status', 'won')
    .gte('created_at', sixMonthsAgo.toISOString())

  if (!wonOffers || wonOffers.length < 5) return anomalies

  const monthBuckets: Record<string, number> = {}
  for (const o of wonOffers as Row[]) {
    const d = new Date(o['created_at'] as string)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthBuckets[key] = (monthBuckets[key] ?? 0) + (Number(o['amount_chf']) || 0)
  }

  const sorted = Object.entries(monthBuckets).sort((a, b) => a[0].localeCompare(b[0]))
  if (sorted.length < 3) return anomalies

  const values = sorted.map(([, v]) => v)
  const lastMonth = values[values.length - 1]!
  const prev = values.slice(0, -1)
  const avg = mean(prev)
  const sd = stddev(prev)

  if (sd > 0) {
    const z = (lastMonth - avg) / sd
    if (z < -1.5) {
      anomalies.push({
        type: 'revenue_drop',
        severity: z < -2.5 ? 'critical' : 'warning',
        entity_id: null,
        entity_name: null,
        metric: 'monthly_won_revenue',
        current_value: Math.round(lastMonth),
        baseline_value: Math.round(avg),
        deviation_pct: avg > 0 ? Math.round(((lastMonth - avg) / avg) * 100) : -100,
        message: `Monatlicher Umsatz ist stark gesunken: CHF ${Math.round(lastMonth).toLocaleString('de-CH')} vs. Durchschnitt CHF ${Math.round(avg).toLocaleString('de-CH')} (z=${z.toFixed(2)}).`,
      })
    }
  }
  return anomalies
}

// ---------------------------------------------------------------------------
// POST handler — manual scan
// ---------------------------------------------------------------------------

export async function POST() {
  const session = await getSession()
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const companyId = session.companyId

  const detected: DetectedAnomaly[] = []
  const detectors = [
    detectLeadIngestionStopped,
    detectConnectorSyncFailure,
    detectOfferWinRateDrop,
    detectStalledProjects,
    detectRevenueAnomaly,
  ]

  for (const detector of detectors) {
    try {
      const items = await detector(db, companyId)
      detected.push(...items)
    } catch (err) {
      console.error('[anomaly-scan] Detector error:', err)
    }
  }

  // Fetch existing active anomalies
  const { data: existing } = await db
    .from('anomalies')
    .select('id, type, entity_id')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const existingKeys = new Map<string, string>()
  for (const e of (existing ?? []) as Row[]) {
    existingKeys.set(anomalyKey(e['type'] as string, e['entity_id'] as string | null), e['id'] as string)
  }

  // Insert new anomalies
  const detectedKeys = new Set<string>()
  const newAnomalies: DetectedAnomaly[] = []

  for (const a of detected) {
    const key = anomalyKey(a.type, a.entity_id)
    detectedKeys.add(key)
    if (!existingKeys.has(key)) {
      newAnomalies.push(a)
    }
  }

  let inserted = 0
  if (newAnomalies.length > 0) {
    const rows = newAnomalies.map((a) => ({
      company_id: companyId,
      type: a.type,
      severity: a.severity,
      entity_id: a.entity_id,
      entity_name: a.entity_name,
      metric: a.metric,
      current_value: a.current_value,
      baseline_value: a.baseline_value,
      deviation_pct: a.deviation_pct,
      message: a.message,
      is_active: true,
      notified: false,
    }))

    const { error } = await db.from('anomalies').insert(rows)
    if (!error) inserted = newAnomalies.length
  }

  // Resolve stale anomalies
  const staleIds: string[] = []
  for (const [key, id] of existingKeys) {
    if (!detectedKeys.has(key)) staleIds.push(id)
  }

  let resolved = 0
  if (staleIds.length > 0) {
    const { error } = await db
      .from('anomalies')
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .in('id', staleIds)
    if (!error) resolved = staleIds.length
  }

  return NextResponse.json({
    success: true,
    detected: detected.length,
    inserted,
    resolved,
    anomalies: detected.map(a => ({
      type: a.type,
      severity: a.severity,
      metric: a.metric,
      message: a.message,
    })),
  })
}
