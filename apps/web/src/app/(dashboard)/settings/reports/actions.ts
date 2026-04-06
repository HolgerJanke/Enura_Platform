'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'
import { writeAuditLog } from '@/lib/audit'

export async function saveReportSettingsAction(data: {
  reportSendTime: string
  reportTimezone: string
  reportRecipientsAll: boolean
  stalledProjectDays: number
  unworkedLeadHours: number
  maxWhisperUsdMonthly: number
}): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.tenantId) return { error: 'Nicht autorisiert' }

  // Basic validation
  if (data.stalledProjectDays < 1 || data.stalledProjectDays > 365) {
    return { error: 'Stagnierte Projekte: Wert muss zwischen 1 und 365 liegen.' }
  }
  if (data.unworkedLeadHours < 1 || data.unworkedLeadHours > 720) {
    return { error: 'Unbearbeitete Leads: Wert muss zwischen 1 und 720 liegen.' }
  }
  if (data.maxWhisperUsdMonthly < 0 || data.maxWhisperUsdMonthly > 10000) {
    return { error: 'Max. Transkription: Wert muss zwischen 0 und 10.000 liegen.' }
  }

  const db = createSupabaseServiceClient()

  const { error: upsertError } = await db.from('tenant_settings').upsert({
    tenant_id: session.tenantId,
    report_send_time: data.reportSendTime,
    report_timezone: data.reportTimezone,
    report_recipients_all: data.reportRecipientsAll,
    stalled_project_days: data.stalledProjectDays,
    unworked_lead_hours: data.unworkedLeadHours,
    max_whisper_usd_monthly: String(data.maxWhisperUsdMonthly),
  }, { onConflict: 'tenant_id' })

  if (upsertError) {
    return { error: 'Fehler beim Speichern. Bitte versuchen Sie es erneut.' }
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    actorId: session.profile.id,
    action: 'report_settings.updated',
    tableName: 'tenant_settings',
  })

  return { success: true }
}

export async function triggerManualReportAction(): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.tenantId) return { error: 'Nicht autorisiert' }

  // In production, this would enqueue a BullMQ job
  // For now, log and return success
  console.log(`[manual-report] Triggered for tenant ${session.tenantId}`)

  await writeAuditLog({
    tenantId: session.tenantId,
    actorId: session.profile.id,
    action: 'report.manual_trigger',
    tableName: 'daily_reports',
  })

  return { success: true }
}
