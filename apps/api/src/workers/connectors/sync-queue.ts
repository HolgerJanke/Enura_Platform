import { createClient } from '@supabase/supabase-js'
import { getConnectorImpl } from './registry.js'
import { writeSyncResult } from './sync-writer.js'
import type { ConnectorConfig } from './base.js'

export interface SyncJobData {
  connectorId: string
  tenantId: string
  type: string
  trigger: 'scheduled' | 'manual' | 'webhook'
}

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function processSyncJob(job: SyncJobData): Promise<void> {
  const db = getServiceClient()

  const { data: connector } = await db
    .from('connectors')
    .select('*')
    .eq('id', job.connectorId)
    .single()

  if (!connector) {
    console.error(`[sync] Connector not found: ${job.connectorId}`)
    return
  }

  const config = connector as unknown as ConnectorConfig

  if (config.status === 'disconnected' || config.status === 'paused') {
    console.log(`[sync] Skipping ${config.type} — status: ${config.status}`)
    return
  }

  const impl = getConnectorImpl(job.type)
  const startedAt = new Date()

  // Mark as syncing
  await db.from('connectors').update({ status: 'active' }).eq('id', job.connectorId)

  const result = await impl.sync(job.tenantId, config)
  await writeSyncResult(job.connectorId, job.tenantId, startedAt, result)

  console.log(
    `[sync] ${job.type} for ${job.tenantId}: ${result.recordsWritten} written, ${result.errors.length} errors, ${result.durationMs}ms`,
  )
}
