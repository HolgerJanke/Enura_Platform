'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'
import { writeAuditLog } from '@/lib/audit'

type OverrideScoresInput = {
  callId: string
  scores: {
    greeting: number
    objection: number
    closing: number
    tone: number
  }
  notes: string
}

type OverrideResult = { error?: string; success?: boolean }

function validateScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10
}

export async function overrideCallScoresAction(
  data: OverrideScoresInput,
): Promise<OverrideResult> {
  const session = await getSession()
  if (!session?.tenantId) return { error: 'Nicht autorisiert' }

  // Check permission (teamleiter or GF)
  const canOverride =
    session.permissions.includes('module:setter:write') || session.isHoldingAdmin
  if (!canOverride) return { error: 'Keine Berechtigung' }

  // Validate all scores
  const { greeting, objection, closing, tone } = data.scores
  if (
    !validateScore(greeting) ||
    !validateScore(objection) ||
    !validateScore(closing) ||
    !validateScore(tone)
  ) {
    return { error: 'Alle Bewertungen muessen zwischen 1 und 10 liegen' }
  }

  if (!data.callId) {
    return { error: 'Anruf-ID fehlt' }
  }

  const db = createSupabaseServiceClient()
  const overallScore = Math.round((greeting + objection + closing + tone) / 4)

  const { error } = await db
    .from('call_analysis')
    .update({
      greeting_score: greeting,
      needs_analysis_score: objection,
      presentation_score: closing,
      closing_score: tone,
      overall_score: overallScore,
      manual_override: true,
      override_by: session.profile.id,
      override_notes: data.notes,
      override_at: new Date().toISOString(),
    })
    .eq('call_id', data.callId)
    .eq('tenant_id', session.tenantId)

  if (error) {
    console.error('[call-analysis] Override failed:', error)
    return { error: 'Speichern fehlgeschlagen' }
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    actorId: session.profile.id,
    action: 'call_analysis.overridden',
    tableName: 'call_analysis',
    recordId: data.callId,
    newValues: { scores: data.scores, notes: data.notes },
  })

  return { success: true }
}
