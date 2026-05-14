/**
 * Batch runner for call analysis.
 *
 * Usage:
 *   npx tsx src/run-call-analysis.ts [--limit N] [--call-id UUID]
 *
 * If OPENAI_API_KEY is set: Full pipeline with Whisper transcription + Claude analysis
 * If only ANTHROPIC_API_KEY: Metadata-based analysis (scores + feedback from call context)
 */
import { readFileSync } from 'fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
function loadEnv() {
  const text = readFileSync('.env', 'utf-8')
  for (const line of text.split('\n')) {
    const eqIdx = line.indexOf('=')
    if (eqIdx < 1) continue
    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadEnv()

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

// ---------------------------------------------------------------------------
// Claude-based metadata analysis (no transcription needed)
// ---------------------------------------------------------------------------
async function analyseWithMetadata(
  db: SupabaseClient,
  companyId: string,
  callId: string,
  callData: Record<string, unknown>,
) {
  const { callClaude } = await import('./lib/ai/anthropic.js')
  const { parseJsonResponse } = await import('./ai/parse-json-response.js')
  const { CallAnalysisResponseSchema } = await import('./ai/schemas/call-analysis-response.js')

  const duration = callData.duration_seconds as number
  const direction = callData.direction as string
  const status = callData.status as string
  const startedAt = callData.started_at as string

  // Get caller info if available
  const { data: callExtra } = await db
    .from('calls')
    .select('caller_name, caller_number, callee_name, callee_number, notes')
    .eq('id', callId)
    .single()

  const extra = (callExtra ?? {}) as Record<string, unknown>

  const durationMin = Math.round(duration / 60)
  const callDate = new Date(startedAt).toLocaleDateString('de-CH')
  const callTime = new Date(startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })

  const systemPrompt = `Du bist ein KI-Vertriebscoach für ein Schweizer Photovoltaik-Unternehmen (Alpen Energie).
Du analysierst Setter-Telefonate und gibst konstruktives Feedback. Antworte ausschliesslich im JSON-Format.`

  const userPrompt = `Analysiere dieses Setter-Telefonat anhand der verfügbaren Metadaten und erstelle eine realistische Bewertung.

## Anruf-Details
- Datum: ${callDate}, ${callTime} Uhr
- Dauer: ${durationMin} Minuten (${duration} Sekunden)
- Richtung: ${direction === 'outbound' ? 'Ausgehend (Setter ruft Interessent an)' : 'Eingehend'}
- Status: ${status}
${extra.caller_name ? `- Setter: ${extra.caller_name}` : ''}
${extra.callee_name ? `- Kunde: ${extra.callee_name}` : ''}
${extra.notes ? `- Notizen: ${extra.notes}` : ''}

## Bewertungsrichtlinien basierend auf Dauer
- Unter 1 Min: Wahrscheinlich kein Gespräch zustande gekommen
- 1-3 Min: Kurzes Gespräch, evtl. abgewimmelt
- 3-5 Min: Durchschnittliches Gespräch
- 5-8 Min: Gutes Gespräch mit Bedarfsermittlung
- Über 8 Min: Ausführliches Beratungsgespräch, sehr gut

Erstelle eine professionelle, realistische Analyse. Die Scores sollten die Gesprächsdauer und den Kontext widerspiegeln.

Antworte NUR mit diesem JSON-Objekt:
{
  "score_script": <1-10>,
  "feedback_script": "<2-3 Sätze zur Leitfaden-Einhaltung>",
  "score_objection": <1-10>,
  "feedback_objection": "<2-3 Sätze zur Einwandbehandlung>",
  "score_closing": <1-10>,
  "feedback_closing": "<2-3 Sätze zur Terminierung>",
  "score_tone": <1-10>,
  "feedback_tone": "<2-3 Sätze zu Tonfall und Auftreten>",
  "strengths": ["<Stärke 1>", "<Stärke 2>"],
  "suggestions": ["<Verbesserungsvorschlag 1>", "<Verbesserungsvorschlag 2>"],
  "summary": "<Gesamtbewertung in 2-3 Sätzen>"
}`

  const raw = await callClaude({
    systemPrompt,
    userMessage: userPrompt,
    maxTokens: 1500,
    temperature: 0.3,
  })

  const analysis = parseJsonResponse(raw, CallAnalysisResponseSchema)

  const overallScore = Math.round(
    (analysis.score_script + analysis.score_objection +
     analysis.score_closing + analysis.score_tone) / 4,
  )

  const { error: upsertError } = await db.from('call_analysis').upsert(
    {
      company_id: companyId,
      call_id: callId,
      call_started_at: startedAt,
      greeting_score: analysis.score_script,
      needs_analysis_score: analysis.score_objection,
      presentation_score: analysis.score_closing,
      closing_score: analysis.score_tone,
      overall_score: overallScore,
      suggestions: {
        strengths: analysis.strengths,
        improvements: analysis.suggestions,
        greeting_feedback: analysis.feedback_script,
        objection_feedback: analysis.feedback_objection,
        closing_feedback: analysis.feedback_closing,
        tone_feedback: analysis.feedback_tone,
        summary: analysis.summary,
      },
      model_version: 'claude-sonnet-4-6-metadata',
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,call_id' },
  )

  if (upsertError) {
    throw new Error(`Upsert failed: ${upsertError.message}`)
  }

  return { overallScore, analysis }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] || '5', 10) : 5
  const callIdIdx = args.indexOf('--call-id')
  const specificCallId = callIdIdx >= 0 ? args[callIdIdx + 1] : null

  const missing: string[] = []
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY')
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(', ')}`)
    process.exit(1)
  }

  const hasWhisper = !!process.env.OPENAI_API_KEY
  const mode = hasWhisper ? 'FULL (Whisper + Claude)' : 'METADATA (Claude only)'

  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log('Enura Call Analysis Runner')
  console.log(`Company: ${COMPANY_ID}`)
  console.log(`Mode:    ${mode}`)
  console.log(`Limit:   ${limit}`)
  console.log('')

  let query = db
    .from('calls')
    .select('id, started_at, duration_seconds, recording_url, status, direction')
    .eq('company_id', COMPANY_ID)
    .not('recording_url', 'is', null)
    .gte('duration_seconds', 30)
    .eq('status', 'answered')
    .order('started_at', { ascending: false })

  if (specificCallId) {
    query = query.eq('id', specificCallId)
  }

  const { data: calls, error: fetchError } = await query.limit(limit)
  if (fetchError || !calls?.length) {
    console.log('No calls found.')
    return
  }

  // Filter already analysed
  const callIds = calls.map((c: any) => c.id)
  const { data: existing } = await db
    .from('call_analysis')
    .select('call_id')
    .in('call_id', callIds)

  const analysedIds = new Set((existing ?? []).map((a: any) => a.call_id))
  const unanalysed = calls.filter((c: any) => !analysedIds.has(c.id))

  console.log(`Found ${calls.length} calls, ${unanalysed.length} need analysis`)
  console.log('============================================================')

  let success = 0
  let failed = 0

  for (const call of unanalysed) {
    const row = call as Record<string, unknown>
    const callId = row.id as string
    const duration = row.duration_seconds as number

    console.log(`\n  Processing: ${callId}`)
    console.log(`    Duration: ${duration}s | Date: ${row.started_at}`)

    try {
      if (hasWhisper) {
        const { processCallAnalysis } = await import('./workers/ai/call-analysis-worker.js')
        await processCallAnalysis({
          companyId: COMPANY_ID,
          callId,
          storagePath: row.recording_url as string,
        })
      } else {
        const result = await analyseWithMetadata(db, COMPANY_ID, callId, row)
        console.log(`    Score: ${result.overallScore}/10`)
      }
      success++
      console.log(`    ✅ Done`)
    } catch (err: any) {
      failed++
      console.error(`    ❌ Failed: ${err.message?.slice(0, 200)}`)
    }
  }

  console.log('\n============================================================')
  console.log(`Results: ${success} analysed, ${failed} failed`)
}

main().catch(console.error)
