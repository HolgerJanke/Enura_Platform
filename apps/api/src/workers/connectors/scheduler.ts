import { createClient } from '@supabase/supabase-js'
import { processSyncJob, type SyncJobData } from './sync-queue.js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function runScheduledSync(): Promise<void> {
  const db = getServiceClient()

  const { data: connectors } = await db
    .from('connectors')
    .select('id, tenant_id, type, sync_interval_minutes, last_synced_at, status')
    .in('status', ['active', 'error'])

  const now = Date.now()

  for (const connector of connectors ?? []) {
    const c = connector as Record<string, unknown>
    const lastSync = c['last_synced_at']
      ? new Date(c['last_synced_at'] as string).getTime()
      : 0
    const intervalMs = ((c['sync_interval_minutes'] as number) ?? 15) * 60 * 1000

    if (now - lastSync < intervalMs) continue

    const job: SyncJobData = {
      connectorId: c['id'] as string,
      tenantId: c['tenant_id'] as string,
      type: c['type'] as string,
      trigger: 'scheduled',
    }

    try {
      await processSyncJob(job)
    } catch (err) {
      console.error(`[scheduler] Failed to sync ${c['type']} for ${c['tenant_id']}:`, err)
    }
  }
}
