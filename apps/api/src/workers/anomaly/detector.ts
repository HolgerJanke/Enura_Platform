// =============================================================================
// Anomaly Detector — Statistical detection for BI metrics
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AnomalyType, AnomalySeverity } from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedAnomaly {
  type: AnomalyType
  severity: AnomalySeverity
  entityId: string | null
  entityName: string | null
  metric: string
  currentValue: number
  baselineValue: number
  deviationPct: number
  message: string
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map((v) => (v - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1))
}

function zScore(value: number, avg: number, sd: number): number {
  if (sd === 0) return 0
  return (value - avg) / sd
}

function deviationPercent(current: number, baseline: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100
  return ((current - baseline) / baseline) * 100
}

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Detector: setter_call_volume_drop
// z-score below -2.0 vs 7-day rolling average
// ---------------------------------------------------------------------------

async function detectSetterCallVolumeDrop(
  companyId: string,
  client: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Get setter snapshots for the last 7 days
  const { data: snapshots } = await client
    .from('kpi_snapshots')
    .select('entity_id, metrics, period_date')
    .eq('company_id', companyId)
    .eq('snapshot_type', 'setter_daily')
    .gte('period_date', sevenDaysAgo.toISOString().split('T')[0]!)
    .order('period_date', { ascending: true })

  if (!snapshots || snapshots.length === 0) return anomalies

  // Group by entity_id
  const byEntity = new Map<string, { date: string; calls: number }[]>()
  for (const snap of snapshots) {
    const entityId = (snap as Record<string, unknown>)['entity_id'] as string | null
    if (!entityId) continue
    const metrics = (snap as Record<string, unknown>)['metrics'] as Record<string, unknown> | null
    if (!metrics) continue
    const calls = Number(metrics['total_calls'] ?? metrics['calls_today'] ?? 0)
    const date = (snap as Record<string, unknown>)['period_date'] as string

    const existing = byEntity.get(entityId) ?? []
    existing.push({ date, calls })
    byEntity.set(entityId, existing)
  }

  // Get team member names
  const entityIds = Array.from(byEntity.keys())
  const { data: members } = await client
    .from('team_members')
    .select('id, display_name')
    .eq('company_id', companyId)
    .in('id', entityIds)

  const nameMap = new Map<string, string>()
  for (const m of members ?? []) {
    const rec = m as Record<string, unknown>
    nameMap.set(rec['id'] as string, (rec['display_name'] as string) ?? 'Unbekannt')
  }

  for (const [entityId, entries] of byEntity) {
    if (entries.length < 3) continue // need enough data points
    const callValues = entries.map((e) => e.calls)
    const todayValue = callValues[callValues.length - 1]!
    const historicalValues = callValues.slice(0, -1)

    const avg = mean(historicalValues)
    const sd = standardDeviation(historicalValues)
    const z = zScore(todayValue, avg, sd)

    if (z < -2.0) {
      const name = nameMap.get(entityId) ?? 'Unbekannt'
      anomalies.push({
        type: 'setter_call_volume_drop',
        severity: z < -3.0 ? 'critical' : 'warning',
        entityId,
        entityName: name,
        metric: 'calls_per_day',
        currentValue: todayValue,
        baselineValue: Math.round(avg * 100) / 100,
        deviationPct: Math.round(deviationPercent(todayValue, avg) * 100) / 100,
        message: `Anrufvolumen von ${name} ist stark gesunken: ${todayValue} Anrufe heute vs. Durchschnitt ${avg.toFixed(1)} (z-Score: ${z.toFixed(2)})`,
      })
    }
  }

  return anomalies
}

// ---------------------------------------------------------------------------
// Detector: lead_ingestion_stopped
// No new leads for 8+ hours during business hours
// ---------------------------------------------------------------------------

async function detectLeadIngestionStopped(
  companyId: string,
  client: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const now = new Date()
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000)

  const { count } = await client
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', eightHoursAgo.toISOString())

  // Check if there were leads in the previous 8-hour window (to confirm this is unusual)
  const sixteenHoursAgo = new Date(now.getTime() - 16 * 60 * 60 * 1000)
  const { count: previousCount } = await client
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', sixteenHoursAgo.toISOString())
    .lt('created_at', eightHoursAgo.toISOString())

  if ((count ?? 0) === 0 && (previousCount ?? 0) > 0) {
    anomalies.push({
      type: 'lead_ingestion_stopped',
      severity: 'critical',
      entityId: null,
      entityName: null,
      metric: 'leads_last_8h',
      currentValue: 0,
      baselineValue: previousCount ?? 0,
      deviationPct: -100,
      message: `Seit ${eightHoursAgo.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr sind keine neuen Leads eingegangen. Vorheriger Zeitraum: ${previousCount} Leads. Bitte Connector prüfen.`,
    })
  }

  return anomalies
}

// ---------------------------------------------------------------------------
// Detector: connector_sync_failure
// Not synced in 2x the configured interval
// ---------------------------------------------------------------------------

async function detectConnectorSyncFailure(
  companyId: string,
  client: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []

  const { data: connectors } = await client
    .from('connectors')
    .select('id, type, display_name, sync_interval_minutes, last_synced_at, status')
    .eq('company_id', companyId)
    .eq('status', 'active')

  const now = new Date()

  for (const connector of connectors ?? []) {
    const rec = connector as Record<string, unknown>
    const lastSynced = rec['last_synced_at'] as string | null
    const intervalMinutes = Number(rec['sync_interval_minutes'] ?? 15)
    const connectorName = (rec['display_name'] as string) ?? (rec['type'] as string)
    const connectorId = rec['id'] as string

    if (!lastSynced) {
      anomalies.push({
        type: 'connector_sync_failure',
        severity: 'critical',
        entityId: connectorId,
        entityName: connectorName,
        metric: 'sync_age_minutes',
        currentValue: -1,
        baselineValue: intervalMinutes,
        deviationPct: 100,
        message: `Connector "${connectorName}" wurde noch nie synchronisiert. Bitte Konfiguration prüfen.`,
      })
      continue
    }

    const lastSyncedDate = new Date(lastSynced)
    const ageMinutes = (now.getTime() - lastSyncedDate.getTime()) / (60 * 1000)
    const threshold = intervalMinutes * 2

    if (ageMinutes > threshold) {
      anomalies.push({
        type: 'connector_sync_failure',
        severity: ageMinutes > intervalMinutes * 4 ? 'critical' : 'warning',
        entityId: connectorId,
        entityName: connectorName,
        metric: 'sync_age_minutes',
        currentValue: Math.round(ageMinutes),
        baselineValue: intervalMinutes,
        deviationPct: Math.round(deviationPercent(ageMinutes, intervalMinutes) * 100) / 100,
        message: `Connector "${connectorName}" hat seit ${Math.round(ageMinutes)} Minuten nicht synchronisiert (Intervall: ${intervalMinutes} Min.). Letzter Sync: ${lastSyncedDate.toLocaleString('de-CH')}.`,
      })
    }
  }

  return anomalies
}

// ---------------------------------------------------------------------------
// Detector: reach_rate_drop
// 20% absolute drop vs 7-day average
// ---------------------------------------------------------------------------

async function detectReachRateDrop(
  companyId: string,
  client: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: snapshots } = await client
    .from('kpi_snapshots')
    .select('entity_id, metrics, period_date')
    .eq('company_id', companyId)
    .eq('snapshot_type', 'setter_daily')
    .gte('period_date', sevenDaysAgo.toISOString().split('T')[0]!)
    .order('period_date', { ascending: true })

  if (!snapshots || snapshots.length === 0) return anomalies

  // Group reach rates by entity
  const byEntity = new Map<string, number[]>()
  for (const snap of snapshots) {
    const entityId = (snap as Record<string, unknown>)['entity_id'] as string | null
    if (!entityId) continue
    const metrics = (snap as Record<string, unknown>)['metrics'] as Record<string, unknown> | null
    if (!metrics) continue
    const reachRate = Number(metrics['reach_rate'] ?? 0)
    const existing = byEntity.get(entityId) ?? []
    existing.push(reachRate)
    byEntity.set(entityId, existing)
  }

  // Get team member names
  const entityIds = Array.from(byEntity.keys())
  const { data: members } = await client
    .from('team_members')
    .select('id, display_name')
    .eq('company_id', companyId)
    .in('id', entityIds)

  const nameMap = new Map<string, string>()
  for (const m of members ?? []) {
    const rec = m as Record<string, unknown>
    nameMap.set(rec['id'] as string, (rec['display_name'] as string) ?? 'Unbekannt')
  }

  for (const [entityId, rates] of byEntity) {
    if (rates.length < 3) continue
    const todayRate = rates[rates.length - 1]!
    const historicalRates = rates.slice(0, -1)
    const avg = mean(historicalRates)
    const absoluteDrop = avg - todayRate

    if (absoluteDrop >= 20) {
      const name = nameMap.get(entityId) ?? 'Unbekannt'
      anomalies.push({
        type: 'reach_rate_drop',
        severity: absoluteDrop >= 30 ? 'critical' : 'warning',
        entityId,
        entityName: name,
        metric: 'reach_rate',
        currentValue: Math.round(todayRate * 100) / 100,
        baselineValue: Math.round(avg * 100) / 100,
        deviationPct: Math.round(deviationPercent(todayRate, avg) * 100) / 100,
        message: `Erreichbarkeitsrate von ${name} ist um ${absoluteDrop.toFixed(1)} Prozentpunkte gefallen: ${todayRate.toFixed(1)}% heute vs. Durchschnitt ${avg.toFixed(1)}%.`,
      })
    }
  }

  return anomalies
}

// ---------------------------------------------------------------------------
// Detector: call_quality_drop
// Average score dropped 1.5+ points over 7 days
// ---------------------------------------------------------------------------

async function detectCallQualityDrop(
  companyId: string,
  client: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Recent 7 days call analysis scores
  const { data: recentAnalysis } = await client
    .from('call_analysis')
    .select('team_member_id, overall_score')
    .eq('company_id', companyId)
    .gte('created_at', sevenDaysAgo.toISOString())

  // Previous 7 days call analysis scores
  const { data: previousAnalysis } = await client
    .from('call_analysis')
    .select('team_member_id, overall_score')
    .eq('company_id', companyId)
    .gte('created_at', fourteenDaysAgo.toISOString())
    .lt('created_at', sevenDaysAgo.toISOString())

  if (!recentAnalysis || !previousAnalysis) return anomalies
  if (recentAnalysis.length === 0 || previousAnalysis.length === 0) return anomalies

  // Group by team member
  const recentByMember = new Map<string, number[]>()
  for (const a of recentAnalysis) {
    const rec = a as Record<string, unknown>
    const memberId = rec['team_member_id'] as string
    const score = Number(rec['overall_score'] ?? 0)
    const existing = recentByMember.get(memberId) ?? []
    existing.push(score)
    recentByMember.set(memberId, existing)
  }

  const previousByMember = new Map<string, number[]>()
  for (const a of previousAnalysis) {
    const rec = a as Record<string, unknown>
    const memberId = rec['team_member_id'] as string
    const score = Number(rec['overall_score'] ?? 0)
    const existing = previousByMember.get(memberId) ?? []
    existing.push(score)
    previousByMember.set(memberId, existing)
  }

  // Get member names
  const allMemberIds = Array.from(new Set([...recentByMember.keys(), ...previousByMember.keys()]))
  const { data: members } = await client
    .from('team_members')
    .select('id, display_name')
    .eq('company_id', companyId)
    .in('id', allMemberIds)

  const nameMap = new Map<string, string>()
  for (const m of members ?? []) {
    const rec = m as Record<string, unknown>
    nameMap.set(rec['id'] as string, (rec['display_name'] as string) ?? 'Unbekannt')
  }

  for (const [memberId, recentScores] of recentByMember) {
    const previousScores = previousByMember.get(memberId)
    if (!previousScores || previousScores.length < 2) continue

    const recentAvg = mean(recentScores)
    const previousAvg = mean(previousScores)
    const drop = previousAvg - recentAvg

    if (drop >= 1.5) {
      const name = nameMap.get(memberId) ?? 'Unbekannt'
      anomalies.push({
        type: 'call_quality_drop',
        severity: drop >= 2.5 ? 'critical' : 'warning',
        entityId: memberId,
        entityName: name,
        metric: 'call_quality_score',
        currentValue: Math.round(recentAvg * 100) / 100,
        baselineValue: Math.round(previousAvg * 100) / 100,
        deviationPct: Math.round(deviationPercent(recentAvg, previousAvg) * 100) / 100,
        message: `Anrufqualitaet von ${name} ist um ${drop.toFixed(1)} Punkte gesunken: ${recentAvg.toFixed(1)} (letzte 7 Tage) vs. ${previousAvg.toFixed(1)} (vorherige 7 Tage).`,
      })
    }
  }

  return anomalies
}

// ---------------------------------------------------------------------------
// Public API: Run all detectors for a tenant
// ---------------------------------------------------------------------------

export async function runAllDetectors(companyId: string): Promise<DetectedAnomaly[]> {
  const client = getServiceClient()
  const results: DetectedAnomaly[] = []

  const detectors = [
    detectSetterCallVolumeDrop,
    detectLeadIngestionStopped,
    detectConnectorSyncFailure,
    detectReachRateDrop,
    detectCallQualityDrop,
  ]

  for (const detector of detectors) {
    try {
      const detected = await detector(companyId, client)
      results.push(...detected)
    } catch (err) {
      console.error(`[AnomalyDetector] Detector failed for tenant ${companyId}:`, err)
    }
  }

  return results
}
