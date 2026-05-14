import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Row = Record<string, unknown>

/**
 * POST /api/call-analysis
 *
 * Triggers AI call analysis for a specific call or batch of recent calls.
 * Body: { callId?: string } — if no callId, analyses up to 5 recent unanalysed calls.
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

  // Find calls that need analysis
  let query = db
    .from('calls')
    .select('id, started_at, duration_seconds, recording_url, status')
    .eq('company_id', companyId)
    .not('recording_url', 'is', null)
    .gte('duration_seconds', 30)
    .eq('status', 'answered')
    .order('started_at', { ascending: false })

  if (specificCallId) {
    query = query.eq('id', specificCallId)
  }

  const { data: calls } = await query.limit(specificCallId ? 1 : 5)
  if (!calls || calls.length === 0) {
    return NextResponse.json({
      message: 'Keine Anrufe mit Aufnahmen gefunden.',
      analysed: 0,
    })
  }

  // Filter out already analysed
  const callIds = calls.map((c: Row) => c.id as string)
  const { data: existing } = await db
    .from('call_analysis')
    .select('call_id')
    .in('call_id', callIds)

  const analysedSet = new Set((existing ?? []).map((a: Row) => a.call_id))
  const toAnalyse = specificCallId
    ? calls
    : calls.filter((c: Row) => !analysedSet.has(c.id as string))

  if (toAnalyse.length === 0) {
    return NextResponse.json({
      message: 'Alle Anrufe bereits analysiert.',
      analysed: 0,
    })
  }

  // Check if API keys are available
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasClaude = !!process.env.ANTHROPIC_API_KEY

  if (!hasClaude) {
    return NextResponse.json({
      error: 'ANTHROPIC_API_KEY nicht konfiguriert.',
      analysed: 0,
    }, { status: 500 })
  }

  if (!hasOpenAI) {
    return NextResponse.json({
      error: 'OPENAI_API_KEY für Whisper-Transkription nicht konfiguriert. Bitte in Vercel Environment Variables hinzufügen.',
      analysed: 0,
    }, { status: 500 })
  }

  // Dynamically import the analysis worker (heavy dependencies)
  let processCallAnalysis: (job: { companyId: string; callId: string; storagePath: string }) => Promise<void>
  try {
    const mod = await import('@enura/api/workers/ai/call-analysis-worker')
    processCallAnalysis = mod.processCallAnalysis
  } catch {
    // Fallback: worker not available in web app context, return info
    return NextResponse.json({
      message: `${toAnalyse.length} Anrufe bereit für Analyse. Bitte per CLI ausführen: cd apps/api && npx tsx src/run-call-analysis.ts`,
      calls: toAnalyse.map((c: Row) => ({
        id: c.id,
        duration: c.duration_seconds,
        date: c.started_at,
      })),
      analysed: 0,
    })
  }

  const results: Array<{ callId: string; status: string; error?: string }> = []

  for (const call of toAnalyse) {
    const row = call as Row
    const callId = row.id as string
    const storagePath = row.recording_url as string

    try {
      await processCallAnalysis({ companyId, callId, storagePath })
      results.push({ callId, status: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ callId, status: 'error', error: msg })
    }
  }

  const success = results.filter((r) => r.status === 'success').length

  return NextResponse.json({
    message: `${success} von ${toAnalyse.length} Anrufen analysiert.`,
    analysed: success,
    results,
  })
}
