import { createClient } from '@supabase/supabase-js'
import { fetchRecordingBuffer } from '../../ai/fetch-recording.js'
import { transcribeAudio } from '../../ai/transcription.js'
import { normaliseSwissGerman } from '../../ai/swiss-german-normalise.js'
import { scrubPII } from '../../ai/pii-scrubber.js'
import { loadPrompt } from '../../ai/prompts/loader.js'
import { callClaude } from '../../lib/ai/anthropic.js'
import { parseJsonResponse } from '../../ai/parse-json-response.js'
import { CallAnalysisResponseSchema } from '../../ai/schemas/call-analysis-response.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Calls shorter than this are skipped — not enough content to analyse. */
const MIN_ANALYSIS_DURATION_SEC = 10

/**
 * Maximum number of words sent to Claude. Longer transcripts are truncated
 * from the end (most recent portion kept) to stay within token limits.
 */
const MAX_TRANSCRIPT_WORDS = 3000

// ---------------------------------------------------------------------------
// Job data
// ---------------------------------------------------------------------------

export interface CallAnalysisJobData {
  companyId: string
  callId: string
  storagePath: string
}

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

/**
 * Full call analysis pipeline:
 *
 * 1. Verify call duration meets minimum threshold.
 * 2. Download the recording from Supabase Storage.
 * 3. Transcribe with OpenAI Whisper (German / Swiss German).
 * 4. Normalise Swiss German dialect artefacts.
 * 5. Scrub PII (phone numbers, emails, names) before sending to Claude.
 * 6. Load the tenant's active call script (if any).
 * 7. Build the analysis prompt from versioned template files.
 * 8. Call Claude (claude-sonnet-4-6) for structured scoring.
 * 9. Parse and validate the JSON response with Zod.
 * 10. Upsert results into the `call_analysis` table.
 */
export async function processCallAnalysis(
  job: CallAnalysisJobData,
): Promise<void> {
  const { companyId, callId, storagePath } = job
  const db = getServiceClient()

  // -----------------------------------------------------------------------
  // 1. Fetch call record and check duration
  // -----------------------------------------------------------------------
  const { data: call, error: callError } = await db
    .from('calls')
    .select('started_at, duration_seconds')
    .eq('id', callId)
    .eq('company_id', companyId)
    .single()

  if (callError || !call) {
    console.warn(
      `[call-analysis] Call ${callId} not found for tenant ${companyId}`,
    )
    return
  }

  const callRecord = call as Record<string, unknown>
  const durationSec = (callRecord['duration_seconds'] as number) ?? 0

  if (durationSec < MIN_ANALYSIS_DURATION_SEC) {
    console.info(
      `[call-analysis] Call ${callId} too short (${durationSec}s < ${MIN_ANALYSIS_DURATION_SEC}s), skipping`,
    )
    return
  }

  // -----------------------------------------------------------------------
  // 2. Download recording from Supabase Storage
  // -----------------------------------------------------------------------
  const audioBuffer = await fetchRecordingBuffer(storagePath)
  if (!audioBuffer) {
    console.warn(
      `[call-analysis] Recording not found at path: ${storagePath}`,
    )
    return
  }

  // -----------------------------------------------------------------------
  // 3. Transcribe with Whisper
  // -----------------------------------------------------------------------
  const filename = storagePath.split('/').pop() ?? 'call.mp3'

  const transcription = await transcribeAudio(audioBuffer, filename, {
    hints: [
      'Setter-Call',
      'Photovoltaik',
      'Schweiz',
      'Terminvereinbarung',
    ],
  })

  // -----------------------------------------------------------------------
  // 4. Normalise Swiss German dialect
  // -----------------------------------------------------------------------
  let transcript = normaliseSwissGerman(transcription.text)

  // Truncate overly long transcripts — keep the most recent portion
  const words = transcript.split(/\s+/)
  if (words.length > MAX_TRANSCRIPT_WORDS) {
    transcript = words.slice(-MAX_TRANSCRIPT_WORDS).join(' ')
  }

  // -----------------------------------------------------------------------
  // 5. Scrub PII
  // -----------------------------------------------------------------------
  const { data: members } = await db
    .from('team_members')
    .select('first_name, last_name')
    .eq('company_id', companyId)

  const knownNames = (members ?? []).flatMap(
    (m: Record<string, unknown>) =>
      [m['first_name'] as string, m['last_name'] as string].filter(Boolean),
  )

  const { scrubbed: anonTranscript } = scrubPII(transcript, knownNames)

  // -----------------------------------------------------------------------
  // 6. Fetch active call script for this tenant
  // -----------------------------------------------------------------------
  const { data: script } = await db
    .from('call_scripts')
    .select('content')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()

  const scriptContent =
    (script as Record<string, unknown> | null)?.['content'] as string ??
    'Kein Leitfaden hinterlegt.'

  // -----------------------------------------------------------------------
  // 7. Build prompt from versioned template files
  // -----------------------------------------------------------------------
  const callDate = new Date(callRecord['started_at'] as string)
  const durationMin = Math.round(durationSec / 60)

  const systemPrompt = await loadPrompt('call-analysis-system')
  const userPrompt = (await loadPrompt('call-analysis'))
    .replace('{{SCRIPT_CONTENT}}', scriptContent)
    .replace('{{CALL_DATE}}', callDate.toLocaleDateString('de-CH'))
    .replace('{{CALL_DURATION_MIN}}', String(durationMin))
    .replace('{{TRANSCRIPT}}', anonTranscript)

  // -----------------------------------------------------------------------
  // 8. Call Claude API (claude-sonnet-4-6)
  // -----------------------------------------------------------------------
  const rawResponse = await callClaude({
    systemPrompt,
    userMessage: userPrompt,
    maxTokens: 2000,
    temperature: 0,
  })

  // -----------------------------------------------------------------------
  // 9. Parse and validate structured JSON response
  // -----------------------------------------------------------------------
  const analysis = parseJsonResponse(rawResponse, CallAnalysisResponseSchema)

  // -----------------------------------------------------------------------
  // 10. Compute overall score and write to database
  // -----------------------------------------------------------------------
  const overallScore = Math.round(
    (analysis.score_script +
      analysis.score_objection +
      analysis.score_closing +
      analysis.score_tone) /
      4,
  )

  const { error: upsertError } = await db.from('call_analysis').upsert(
    {
      company_id: companyId,
      call_id: callId,
      call_started_at: callRecord['started_at'] as string,
      transcript,
      greeting_score: analysis.score_script,
      needs_analysis_score: analysis.score_objection,
      presentation_score: analysis.score_closing,
      closing_score: analysis.score_tone,
      overall_score: overallScore,
      suggestions: {
        strengths: analysis.strengths,
        improvements: analysis.suggestions,
        feedback: {
          script: analysis.feedback_script,
          objection: analysis.feedback_objection,
          closing: analysis.feedback_closing,
          tone: analysis.feedback_tone,
        },
        summary: analysis.summary,
      },
      model_version: 'claude-sonnet-4-6',
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,call_id' },
  )

  if (upsertError) {
    throw new Error(
      `[call-analysis] Failed to write analysis for call ${callId}: ${upsertError.message}`,
    )
  }

  console.log(
    `[call-analysis] Completed for call ${callId}: overall=${overallScore} ` +
      `(script=${analysis.score_script}, objection=${analysis.score_objection}, ` +
      `closing=${analysis.score_closing}, tone=${analysis.score_tone})`,
  )
}
