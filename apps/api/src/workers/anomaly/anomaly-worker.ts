// =============================================================================
// Anomaly Worker — Runs detection for all active tenants, manages lifecycle
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { runAllDetectors, type DetectedAnomaly } from './detector.js'
import { sendAnomalyAlerts } from './alert-sender.js'

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Duplicate check key: type + entityId (or 'global')
// ---------------------------------------------------------------------------

function anomalyKey(type: string, entityId: string | null): string {
  return `${type}::${entityId ?? 'global'}`
}

// ---------------------------------------------------------------------------
// Process a single tenant
// ---------------------------------------------------------------------------

async function processAnomaliesForTenant(companyId: string): Promise<void> {
  const client = getServiceClient()

  // 1. Run all detectors
  const detected = await runAllDetectors(companyId)

  // 2. Fetch existing active anomalies for this tenant
  const { data: existingAnomalies } = await client
    .from('anomalies')
    .select('id, type, entity_id')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const existingKeys = new Map<string, string>()
  for (const existing of existingAnomalies ?? []) {
    const rec = existing as Record<string, unknown>
    const key = anomalyKey(rec['type'] as string, rec['entity_id'] as string | null)
    existingKeys.set(key, rec['id'] as string)
  }

  // 3. Determine which detected anomalies are new
  const detectedKeys = new Set<string>()
  const newAnomalies: DetectedAnomaly[] = []

  for (const anomaly of detected) {
    const key = anomalyKey(anomaly.type, anomaly.entityId)
    detectedKeys.add(key)
    if (!existingKeys.has(key)) {
      newAnomalies.push(anomaly)
    }
  }

  // 4. Insert new anomalies
  if (newAnomalies.length > 0) {
    const rows = newAnomalies.map((a) => ({
      company_id: companyId,
      type: a.type,
      severity: a.severity,
      entity_id: a.entityId,
      entity_name: a.entityName,
      metric: a.metric,
      current_value: a.currentValue,
      baseline_value: a.baselineValue,
      deviation_pct: a.deviationPct,
      message: a.message,
      is_active: true,
      notified: false,
    }))

    const { error } = await client.from('anomalies').insert(rows)
    if (error) {
      console.error(`[AnomalyWorker] Failed to insert anomalies for tenant ${companyId}:`, error)
    } else {
      console.log(`[AnomalyWorker] Inserted ${newAnomalies.length} new anomalies for tenant ${companyId}`)
    }
  }

  // 5. Resolve stale anomalies (active in DB but no longer detected)
  const staleIds: string[] = []
  for (const [key, id] of existingKeys) {
    if (!detectedKeys.has(key)) {
      staleIds.push(id)
    }
  }

  if (staleIds.length > 0) {
    const { error } = await client
      .from('anomalies')
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .in('id', staleIds)

    if (error) {
      console.error(`[AnomalyWorker] Failed to resolve stale anomalies for tenant ${companyId}:`, error)
    } else {
      console.log(`[AnomalyWorker] Resolved ${staleIds.length} stale anomalies for tenant ${companyId}`)
    }
  }

  // 6. Send alerts for critical anomalies that haven't been notified yet
  await sendAnomalyAlerts(companyId)
}

// ---------------------------------------------------------------------------
// Public API: Process all active tenants
// ---------------------------------------------------------------------------

export async function runAnomalyDetection(): Promise<void> {
  const client = getServiceClient()

  const { data: tenants } = await client
    .from('companies')
    .select('id')
    .eq('status', 'active')

  if (!tenants || tenants.length === 0) {
    console.log('[AnomalyWorker] No active tenants found.')
    return
  }

  console.log(`[AnomalyWorker] Running anomaly detection for ${tenants.length} tenants...`)

  for (const tenant of tenants) {
    const companyId = (tenant as Record<string, unknown>)['id'] as string
    try {
      await processAnomaliesForTenant(companyId)
    } catch (err) {
      console.error(`[AnomalyWorker] Failed for tenant ${companyId}:`, err)
    }
  }

  console.log('[AnomalyWorker] Anomaly detection cycle complete.')
}
