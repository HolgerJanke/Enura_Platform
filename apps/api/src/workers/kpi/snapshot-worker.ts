import type { KpiSnapshotType } from '@enura/types'
import { KPI_SNAPSHOT_TYPES } from '@enura/types'
import { createClient } from '@supabase/supabase-js'
import {
  computeSetterDaily,
  computeLeadsDaily,
  computeFinanceMonthly,
  computeProjectsDaily,
  computeTenantDailySummary,
} from './compute.js'

export interface SnapshotJobData {
  companyId: string
  snapshotType: KpiSnapshotType
  entityId: string | null
  date: string
}

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function processSnapshotJob(job: SnapshotJobData): Promise<void> {
  const { companyId, snapshotType, entityId, date } = job
  const targetDate = new Date(date)

  let metrics: Record<string, unknown>

  switch (snapshotType) {
    case KPI_SNAPSHOT_TYPES.SETTER_DAILY:
      if (!entityId) throw new Error('entityId required for setter_daily')
      metrics = await computeSetterDaily(companyId, entityId, targetDate) as Record<string, unknown>
      break
    case KPI_SNAPSHOT_TYPES.LEADS_DAILY:
      metrics = await computeLeadsDaily(companyId, targetDate) as Record<string, unknown>
      break
    case KPI_SNAPSHOT_TYPES.FINANCE_MONTHLY:
      metrics = await computeFinanceMonthly(companyId, targetDate) as Record<string, unknown>
      break
    case KPI_SNAPSHOT_TYPES.PROJECTS_DAILY:
      metrics = await computeProjectsDaily(companyId, targetDate) as Record<string, unknown>
      break
    case KPI_SNAPSHOT_TYPES.TENANT_DAILY_SUMMARY:
      metrics = await computeTenantDailySummary(companyId, targetDate) as Record<string, unknown>
      break
    default:
      throw new Error(`Unknown snapshot type: ${snapshotType}`)
  }

  const client = getServiceClient()
  const periodDate = targetDate.toISOString().split('T')[0]

  await client
    .from('kpi_snapshots')
    .upsert({
      company_id: companyId,
      snapshot_type: snapshotType,
      entity_id: entityId,
      period_date: periodDate,
      metrics,
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })
}
