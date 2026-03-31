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

  // Upsert connector
  const { error } = await db.from('connectors').upsert({
    company_id: session.companyId,
    type,
    name: getConnectorLabel(type),
    credentials: data.credentials,
    config: data.config,
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

  // Type-specific validation
  switch (type) {
    case 'reonic': {
      if (!credentials['apiBaseUrl'] || !credentials['apiKey']) {
        return { error: 'API Base URL und API Key sind erforderlich.' }
      }
      break
    }
    case '3cx': {
      if (!credentials['apiUrl'] || !credentials['apiKey']) {
        return { error: 'API URL und API Key sind erforderlich.' }
      }
      break
    }
    case 'bexio': {
      // OAuth — no manual credentials to test
      break
    }
    case 'google_calendar': {
      if (!credentials['serviceAccountKey']) {
        return { error: 'Service Account Key ist erforderlich.' }
      }
      // Validate JSON format
      try {
        const key = credentials['serviceAccountKey'] as string
        JSON.parse(key)
      } catch {
        return { error: 'Service Account Key ist kein gueltiges JSON.' }
      }
      break
    }
    case 'leadnotes': {
      if (!credentials['apiKey']) {
        return { error: 'API Key ist erforderlich.' }
      }
      break
    }
    default:
      return { error: `Unbekannter Connector-Typ: ${type}` }
  }

  // In production, this would call the connector's validate() method
  // to actually test the connection against the external API.
  // For now, return success if validation passes.
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

  // Verify connector belongs to this tenant
  const { data: connector } = await db
    .from('connectors')
    .select('id, company_id')
    .eq('id', connectorId)
    .single()

  if (!connector || (connector as Record<string, unknown>)['company_id'] !== session.companyId) {
    return { error: 'Connector nicht gefunden.' }
  }

  // In production, this would enqueue a BullMQ job:
  // await syncQueue.add('connector-sync', { connectorId, companyId: session.companyId })
  // For now, just update the last_synced_at to simulate a sync.
  await db.from('connectors')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connectorId)
    .eq('company_id', session.companyId)

  return { success: true }
}

function getConnectorLabel(type: string): string {
  const labels: Record<string, string> = {
    reonic: 'Reonic CRM',
    '3cx': '3CX Cloud',
    bexio: 'Bexio',
    google_calendar: 'Google Calendar',
    leadnotes: 'Leadnotes',
  }
  return labels[type] ?? type
}
