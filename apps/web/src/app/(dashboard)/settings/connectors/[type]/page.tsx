import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ConnectorForm } from './connector-form'
import { SyncHistory } from './sync-history'

const VALID_TYPES = ['reonic', '3cx', 'bexio', 'google_calendar', 'leadnotes'] as const
type ValidType = (typeof VALID_TYPES)[number]

const CONNECTOR_LABELS: Record<ValidType, string> = {
  reonic: 'Reonic CRM',
  '3cx': '3CX Cloud',
  bexio: 'Bexio',
  google_calendar: 'Google Calendar',
  leadnotes: 'Leadnotes',
}

const CONNECTOR_DESCRIPTIONS: Record<ValidType, string> = {
  reonic: 'Synchronisiert Leads, Angebote und Team-Mitglieder aus dem Reonic CRM.',
  '3cx': 'Synchronisiert Anrufe und Aufnahmen aus der 3CX Cloud-Telefonanlage.',
  bexio: 'Synchronisiert Rechnungen und Zahlungen aus der Bexio Buchhaltung.',
  google_calendar: 'Synchronisiert Termine aller Mitarbeiter aus Google Calendar.',
  leadnotes: 'Synchronisiert eingehende Leads aus dem Leadnotes-System.',
}

function isValidType(type: string): type is ValidType {
  return (VALID_TYPES as readonly string[]).includes(type)
}

export default async function ConnectorConfigPage({
  params,
}: {
  params: { type: string }
}) {
  await requirePermission('module:admin:read')

  const { type } = params
  if (!isValidType(type)) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurück</a></div>)

  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServerClient()

  // Fetch existing connector config
  const { data: connector } = await supabase
    .from('connectors')
    .select('*')
    .eq('company_id', session.companyId)
    .eq('type', type)
    .maybeSingle()

  // Fetch sync logs if connector exists
  const connectorId = (connector as Record<string, unknown> | null)?.['id'] as string | undefined
  const { data: syncLogs } = connectorId
    ? await supabase
        .from('connector_sync_log')
        .select('*')
        .eq('connector_id', connectorId)
        .order('started_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const label = CONNECTOR_LABELS[type]
  const description = CONNECTOR_DESCRIPTIONS[type]

  // Strip credentials for client — only pass whether they exist
  const connectorData = connector
    ? {
        id: (connector as Record<string, unknown>)['id'] as string,
        type: (connector as Record<string, unknown>)['type'] as string,
        status: (connector as Record<string, unknown>)['status'] as string,
        config: (connector as Record<string, unknown>)['config'] as Record<string, unknown> | null,
        credentials: (connector as Record<string, unknown>)['credentials'] as Record<string, unknown> | null,
        syncIntervalMinutes: (connector as Record<string, unknown>)['sync_interval_minutes'] as number | null,
        lastSyncedAt: (connector as Record<string, unknown>)['last_synced_at'] as string | null,
      }
    : null

  return (
    <div className="p-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-brand-text-secondary mb-6" aria-label="Breadcrumb">
        <Link
          href="/settings/connectors"
          className="hover:text-brand-text-primary transition-colors"
        >
          Integrationen
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-brand-text-primary font-medium">{label}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-text-primary">{label}</h1>
        <p className="text-brand-text-secondary mt-1">{description}</p>
      </div>

      {/* Config form */}
      <ConnectorForm
        type={type}
        existingConnector={connectorData}
      />

      {/* Sync history */}
      {connectorId && (
        <div className="mt-8">
          <SyncHistory
            logs={(syncLogs ?? []) as unknown as Array<Record<string, unknown>>}
          />
        </div>
      )}
    </div>
  )
}
