import { createClient } from '@supabase/supabase-js'
import { KPI_SNAPSHOT_TYPES } from '@enura/types'
import type { SnapshotJobData } from './snapshot-worker.js'
import { processSnapshotJob } from './snapshot-worker.js'

export async function scheduleDailySnapshots(date: Date): Promise<void> {
  const client = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: tenants } = await client
    .from('tenants')
    .select('id')
    .eq('status', 'active')

  for (const tenant of tenants ?? []) {
    const tenantId = (tenant as Record<string, unknown>)['id'] as string

    // Get team members
    const { data: members } = await client
      .from('team_members')
      .select('id, role_type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    const setters = (members ?? []).filter((m: Record<string, unknown>) => m['role_type'] === 'setter')

    // Per-setter snapshots
    for (const setter of setters) {
      const job: SnapshotJobData = {
        tenantId,
        snapshotType: KPI_SNAPSHOT_TYPES.SETTER_DAILY,
        entityId: (setter as Record<string, unknown>)['id'] as string,
        date: date.toISOString(),
      }
      await processSnapshotJob(job)
    }

    // Tenant-level snapshots
    for (const type of [
      KPI_SNAPSHOT_TYPES.LEADS_DAILY,
      KPI_SNAPSHOT_TYPES.PROJECTS_DAILY,
      KPI_SNAPSHOT_TYPES.TENANT_DAILY_SUMMARY,
    ] as const) {
      await processSnapshotJob({
        tenantId,
        snapshotType: type,
        entityId: null,
        date: date.toISOString(),
      })
    }

    // Monthly finance (first of month only)
    if (date.getDate() === 1) {
      await processSnapshotJob({
        tenantId,
        snapshotType: KPI_SNAPSHOT_TYPES.FINANCE_MONTHLY,
        entityId: null,
        date: date.toISOString(),
      })
    }
  }
}
