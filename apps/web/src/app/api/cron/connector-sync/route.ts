import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { syncBexio, writeSyncResult } from '@/lib/connectors/bexio-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Row = Record<string, unknown>

/**
 * GET /api/cron/connector-sync
 *
 * Vercel Cron job — runs every hour. Checks all active connectors that are
 * due for sync based on their sync_interval_minutes and triggers the
 * appropriate sync logic.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const now = Date.now()

  const { data: connectors, error: fetchErr } = await db
    .from('connectors')
    .select('id, company_id, type, credentials, config, sync_interval_minutes, last_synced_at, status')
    .in('status', ['active', 'error'])

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const results: Array<{ type: string; companyId: string; success: boolean; records: number; duration: number }> = []
  let synced = 0
  let skipped = 0

  for (const connector of (connectors ?? []) as Row[]) {
    const connectorId = connector['id'] as string
    const companyId = connector['company_id'] as string
    const type = connector['type'] as string
    const intervalMinutes = (connector['sync_interval_minutes'] as number) ?? 60
    const lastSynced = connector['last_synced_at']
      ? new Date(connector['last_synced_at'] as string).getTime()
      : 0

    if (now - lastSynced < intervalMinutes * 60 * 1000) {
      skipped++
      continue
    }

    const startedAt = new Date()

    try {
      switch (type) {
        case 'bexio': {
          const result = await syncBexio(
            companyId,
            connector['credentials'] as Row,
            connector['last_synced_at'] as string | null,
          )
          await writeSyncResult(connectorId, companyId, startedAt, result)
          results.push({ type, companyId, success: result.success, records: result.recordsWritten, duration: result.durationMs })
          synced++
          break
        }
        default:
          skipped++
          continue
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await writeSyncResult(connectorId, companyId, startedAt, {
        success: false, recordsWritten: 0, errors: [{ code: 'CRON_SYNC_ERROR', message: msg, context: {} }],
      })
      results.push({ type, companyId, success: false, records: 0, duration: Date.now() - startedAt.getTime() })
      synced++
    }
  }

  console.log(`[connector-sync] Done: ${synced} synced, ${skipped} skipped`)

  return NextResponse.json({ success: true, synced, skipped, results })
}
