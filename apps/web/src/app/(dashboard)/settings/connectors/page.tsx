export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { ConnectorListClient } from './connector-list-client'

const CONNECTOR_TYPES = [
  { type: 'crm', label: 'CRM', description: 'Leads, Angebote, Kontakte', icon: 'link' },
  { type: 'telephony', label: 'Telefonie', description: 'Anrufe, Aufnahmen', icon: 'phone' },
  { type: 'accounting', label: 'Buchhaltung', description: 'Rechnungen, Zahlungen', icon: 'banknotes' },
  { type: 'calendar', label: 'Kalender', description: 'Termine aller Mitarbeiter', icon: 'calendar' },
  { type: 'leads', label: 'Lead-System', description: 'Eingehende Leads', icon: 'inbox' },
  { type: 'email', label: 'E-Mail', description: 'Posteingang, Versand', icon: 'mail' },
  { type: 'storage', label: 'Dateispeicher', description: 'Dokumente, Belege', icon: 'folder' },
  { type: 'webhook', label: 'Webhooks', description: 'Outgoing Events an Drittsysteme', icon: 'link' },
  { type: 'custom', label: 'Weitere', description: 'Individuelle Anbindung', icon: 'link' },
] as const

export type ConnectorTypeInfo = (typeof CONNECTOR_TYPES)[number]

export default async function ConnectorsPage() {
  await requirePermission('module:admin:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServiceClient()

  // Fetch configured connectors for this tenant
  const { data: connectors } = await supabase
    .from('connectors')
    .select('*')
    .eq('company_id', session.companyId)

  // Fetch latest sync log for each connector
  const connectorIds = (connectors ?? []).map((c: Record<string, unknown>) => c['id'] as string)
  const { data: syncLogs } = connectorIds.length > 0
    ? await supabase
        .from('connector_sync_log')
        .select('*')
        .in('connector_id', connectorIds)
        .order('started_at', { ascending: false })
        .limit(connectorIds.length)
    : { data: [] }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Integrationen</h1>
      <p className="text-sm text-brand-text-secondary mb-6">
        Verbinden Sie externe Systeme, um Daten automatisch zu synchronisieren.
      </p>
      <ConnectorListClient
        connectorTypes={CONNECTOR_TYPES as unknown as ReadonlyArray<ConnectorTypeInfo>}
        configuredConnectors={(connectors ?? []) as unknown as Array<Record<string, unknown>>}
        syncLogs={(syncLogs ?? []) as unknown as Array<Record<string, unknown>>}
        companyId={session.companyId}
      />
    </div>
  )
}
