import { createClient } from '@supabase/supabase-js'
import { processSyncJob, type SyncJobData } from './sync-queue.js'
import { instantiateProcessesForProject } from '../liquidity/instantiate-processes.js'

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
    .select('id, company_id, type, sync_interval_minutes, last_synced_at, status')
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
      companyId: c['company_id'] as string,
      type: c['type'] as string,
      trigger: 'scheduled',
    }

    try {
      await processSyncJob(job)
    } catch (err) {
      console.error(`[scheduler] Failed to sync ${c['type']} for ${c['company_id']}:`, err)
    }
  }

  // Post-sync: instantiate liquidity processes for projects without instances
  await instantiateMissingProcesses(db)
}

// ---------------------------------------------------------------------------
// Instantiate liquidity processes for active projects that are missing them
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function instantiateMissingProcesses(db: any): Promise<void> {
  try {
    // Find companies with deployed process definitions
    const { data: processes } = await db
      .from('process_definitions')
      .select('company_id, holding_id')
      .eq('status', 'deployed')

    if (!processes || processes.length === 0) return

    const companyHoldingMap = new Map<string, string>()
    for (const p of processes) {
      const row = p as Record<string, unknown>
      companyHoldingMap.set(row['company_id'] as string, row['holding_id'] as string)
    }

    for (const [companyId, holdingId] of companyHoldingMap) {
      // Find active projects that might need process instantiation
      const { data: projects } = await db
        .from('projects')
        .select('id')
        .eq('company_id', companyId)
        .in('status', ['active', 'won'])
        .limit(50)

      if (!projects || projects.length === 0) continue

      for (const proj of projects) {
        const projectId = (proj as Record<string, unknown>)['id'] as string
        try {
          const result = await instantiateProcessesForProject(db, projectId, companyId, holdingId)
          if (result.instancesCreated > 0) {
            console.log(
              `[scheduler:liquidity] Instantiated ${result.instancesCreated} processes, ${result.eventsCreated} events for project ${projectId}`,
            )
          }
        } catch (err) {
          console.error(`[scheduler:liquidity] Failed to instantiate for project ${projectId}:`, err)
        }
      }
    }
  } catch (err) {
    console.error('[scheduler:liquidity] Process instantiation sweep failed:', err)
  }
}
