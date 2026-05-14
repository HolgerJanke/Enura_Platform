import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Row = Record<string, unknown>

/**
 * POST /api/call-analysis
 *
 * Returns call analysis status — which calls need analysis and which are done.
 * Actual analysis is run via the CLI: cd apps/api && npx tsx src/run-call-analysis.ts
 */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const specificCallId = body.callId as string | undefined
  const db = createSupabaseServiceClient()
  const companyId = session.companyId

  // Count total calls with recordings
  const { count: totalWithRecording } = await db
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .not('recording_url', 'is', null)
    .gte('duration_seconds', 30)

  // Count existing analyses
  const { count: analysed } = await db
    .from('call_analysis')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  // Find unanalysed calls
  let query = db
    .from('calls')
    .select('id, started_at, duration_seconds, status')
    .eq('company_id', companyId)
    .not('recording_url', 'is', null)
    .gte('duration_seconds', 30)
    .eq('status', 'answered')
    .order('started_at', { ascending: false })

  if (specificCallId) {
    query = query.eq('id', specificCallId)
  }

  const { data: calls } = await query.limit(20)
  const callIds = (calls ?? []).map((c: Row) => c.id as string)

  const { data: existing } = await db
    .from('call_analysis')
    .select('call_id')
    .in('call_id', callIds.length > 0 ? callIds : ['__none__'])

  const analysedSet = new Set((existing ?? []).map((a: Row) => a.call_id))
  const pending = (calls ?? []).filter((c: Row) => !analysedSet.has(c.id as string))

  return NextResponse.json({
    totalWithRecording: totalWithRecording ?? 0,
    totalAnalysed: analysed ?? 0,
    pendingCount: pending.length,
    message: pending.length > 0
      ? `${pending.length} Anrufe warten auf Analyse.`
      : 'Alle aktuellen Anrufe analysiert.',
  })
}
