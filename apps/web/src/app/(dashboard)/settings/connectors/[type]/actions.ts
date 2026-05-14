'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

export async function saveConnectorAction(type: string, data: {
  credentials: Record<string, unknown>
  config: Record<string, unknown>
  syncIntervalMinutes: number
}): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.companyId) return { error: 'Nicht autorisiert' }

  // Validate permission
  if (!session.isHoldingAdmin && !session.permissions.includes('module:admin:read')) {
    return { error: 'Nicht autorisiert' }
  }

  const db = createSupabaseServiceClient()

  // Transform credentials for connectors that need it
  let finalCredentials = data.credentials
  let finalConfig = data.config

  if (type === 'google_calendar') {
    // Parse service account JSON and extract needed fields
    const rawKey = data.credentials['serviceAccountKey']
    if (typeof rawKey === 'string' && rawKey.trim()) {
      try {
        const parsed = JSON.parse(rawKey) as Record<string, unknown>
        finalCredentials = {
          service_account_email: parsed['client_email'] as string,
          private_key: parsed['private_key'] as string,
        }
      } catch {
        return { error: 'Service Account Key ist kein gültiges JSON.' }
      }
    }

    // Parse calendar emails (newline-separated) into array
    const rawEmails = data.credentials['calendarEmails']
    if (typeof rawEmails === 'string' && rawEmails.trim()) {
      const emails = rawEmails
        .split('\n')
        .map((e: string) => e.trim())
        .filter((e: string) => e.length > 0 && e.includes('@'))
      finalConfig = { calendar_ids: emails }
    }
  }

  if (type === 'gmail') {
    // Parse service account JSON for Gmail too
    const rawKey = data.credentials['serviceAccountKey']
    if (typeof rawKey === 'string' && rawKey.trim()) {
      try {
        const parsed = JSON.parse(rawKey) as Record<string, unknown>
        finalCredentials = {
          service_account_email: parsed['client_email'] as string,
          private_key: parsed['private_key'] as string,
          email_address: data.credentials['emailAddress'] as string,
        }
      } catch {
        return { error: 'Service Account Key ist kein gültiges JSON.' }
      }
    }
  }

  // Upsert connector
  const { error } = await db.from('connectors').upsert({
    company_id: session.companyId,
    type,
    name: getConnectorLabel(type),
    credentials: finalCredentials,
    config: finalConfig,
    sync_interval_minutes: data.syncIntervalMinutes,
    status: 'active',
  }, { onConflict: 'company_id,type' })

  if (error) return { error: 'Verbindung konnte nicht gespeichert werden.' }
  return { success: true }
}

export async function testConnectorAction(
  type: string,
  credentials: Record<string, unknown>
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.companyId) return { error: 'Nicht autorisiert' }

  if (!session.isHoldingAdmin && !session.permissions.includes('module:admin:read')) {
    return { error: 'Nicht autorisiert' }
  }

  // Validate that credentials are provided
  if (!credentials || Object.keys(credentials).length === 0) {
    return { error: 'Bitte geben Sie die Zugangsdaten ein.' }
  }

  // Generic validation — at least one credential field must be set
  const filledFields = Object.entries(credentials).filter(
    ([, v]) => typeof v === 'string' ? v.trim().length > 0 : Boolean(v)
  )
  if (filledFields.length === 0) {
    return { error: 'Mindestens ein Zugangsdaten-Feld muss ausgefüllt sein.' }
  }

  // Google Calendar / Gmail: validate JSON in serviceAccountKey if present
  if ((type === 'google_calendar' || type === 'gmail') && credentials['serviceAccountKey']) {
    try {
      JSON.parse(credentials['serviceAccountKey'] as string)
    } catch {
      return { error: 'Service Account Key ist kein gültiges JSON.' }
    }
  }

  // Type-specific validation
  if (type === 'google_calendar' && credentials['serviceAccountKey']) {
    try {
      const parsed = JSON.parse(credentials['serviceAccountKey'] as string) as Record<string, unknown>
      if (!parsed['client_email'] || !parsed['private_key']) {
        return { error: 'Service Account Key muss "client_email" und "private_key" enthalten.' }
      }
    } catch {
      return { error: 'Service Account Key ist kein gültiges JSON.' }
    }
  }

  return { success: true }
}

export async function triggerSyncAction(
  connectorId: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.companyId) return { error: 'Nicht autorisiert' }

  if (!session.isHoldingAdmin && !session.permissions.includes('module:admin:read')) {
    return { error: 'Nicht autorisiert' }
  }

  const db = createSupabaseServiceClient()

  // Load full connector data
  const { data: connector } = await db
    .from('connectors')
    .select('id, company_id, type, credentials, config, last_synced_at, status')
    .eq('id', connectorId)
    .single()

  if (!connector || (connector as Record<string, unknown>)['company_id'] !== session.companyId) {
    return { error: 'Connector nicht gefunden.' }
  }

  const c = connector as Record<string, unknown>
  const type = c['type'] as string
  const companyId = session.companyId
  const startedAt = new Date()

  try {
    switch (type) {
      case 'bexio': {
        const { syncBexio, writeSyncResult } = await import('@/lib/connectors/bexio-sync')
        const result = await syncBexio(
          companyId,
          c['credentials'] as Record<string, unknown>,
          c['last_synced_at'] as string | null,
        )
        await writeSyncResult(connectorId, companyId, startedAt, result)
        if (!result.success) {
          return { error: `Sync fehlgeschlagen: ${result.errors[0]?.message ?? 'Unbekannter Fehler'}` }
        }
        return { success: true }
      }
      case 'reonic': {
        const { syncReonic, writeSyncResult } = await import('@/lib/connectors/reonic-sync')
        const result = await syncReonic(
          companyId,
          c['credentials'] as Record<string, unknown>,
          c['last_synced_at'] as string | null,
        )
        await writeSyncResult(connectorId, companyId, startedAt, result)
        if (!result.success) {
          return { error: `Sync fehlgeschlagen: ${result.errors[0]?.message ?? 'Unbekannter Fehler'}` }
        }
        return { success: true }
      }
      case '3cx': {
        const { syncThreeCX, writeSyncResult } = await import('@/lib/connectors/threecx-sync')
        const result = await syncThreeCX(
          companyId,
          c['credentials'] as Record<string, unknown>,
          c['last_synced_at'] as string | null,
        )
        await writeSyncResult(connectorId, companyId, startedAt, result)
        if (!result.success) {
          return { error: `Sync fehlgeschlagen: ${result.errors[0]?.message ?? 'Unbekannter Fehler'}` }
        }
        return { success: true }
      }
      case 'leadnotes': {
        const { syncLeadnotes, writeSyncResult } = await import('@/lib/connectors/leadnotes-sync')
        const result = await syncLeadnotes(
          companyId,
          c['credentials'] as Record<string, unknown>,
          c['last_synced_at'] as string | null,
        )
        await writeSyncResult(connectorId, companyId, startedAt, result)
        if (!result.success) {
          return { error: `Sync fehlgeschlagen: ${result.errors[0]?.message ?? 'Unbekannter Fehler'}` }
        }
        return { success: true }
      }
      default:
        return { error: `Sync für Typ "${type}" noch nicht implementiert.` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Write error to sync log
    const { writeSyncResult } = await import('@/lib/connectors/bexio-sync')
    await writeSyncResult(connectorId, companyId, startedAt, {
      success: false, recordsWritten: 0, errors: [{ code: 'MANUAL_SYNC_ERROR', message: msg, context: {} }],
    })
    return { error: `Sync-Fehler: ${msg}` }
  }
}

function getConnectorLabel(type: string): string {
  const labels: Record<string, string> = {
    reonic: 'Reonic',
    '3cx': '3CX Cloud',
    bexio: 'Bexio',
    google_calendar: 'Google Calendar',
    leadnotes: 'LeadNotes',
    gmail: 'Gmail',
    whatsapp: 'WhatsApp',
  }
  return labels[type] ?? type
}
