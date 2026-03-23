import { createClient } from '@supabase/supabase-js'
import type { SyncResult } from './base.js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function writeSyncResult(
  connectorId: string,
  tenantId: string,
  startedAt: Date,
  result: SyncResult,
): Promise<void> {
  const db = getServiceClient()
  const finishedAt = new Date()

  await db.from('connector_sync_log').insert({
    connector_id: connectorId,
    tenant_id: tenantId,
    status: result.success ? 'success' : 'error',
    records_synced: result.recordsWritten,
    error_message: result.errors.length > 0
      ? result.errors.map(e => e.message).join('; ')
      : null,
    started_at: startedAt.toISOString(),
    completed_at: finishedAt.toISOString(),
  })

  await db.from('connectors').update({
    last_synced_at: finishedAt.toISOString(),
    status: result.success ? 'active' : 'error',
    last_error: result.errors.length > 0
      ? (result.errors[0]?.message ?? null)
      : null,
  }).eq('id', connectorId)
}
