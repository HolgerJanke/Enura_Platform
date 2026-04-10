import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  ANOMALY_TYPE_LABELS,
  ANOMALY_SEVERITY_LABELS,
  type AnomalyType,
  type AnomalySeverity,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Severity badge component
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  const config: Record<AnomalySeverity, { bg: string; text: string; label: string }> = {
    critical: { bg: 'bg-red-100', text: 'text-red-800', label: ANOMALY_SEVERITY_LABELS.critical },
    warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: ANOMALY_SEVERITY_LABELS.warning },
    info: { bg: 'bg-blue-100', text: 'text-blue-800', label: ANOMALY_SEVERITY_LABELS.info },
  }
  const c = config[severity]

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
      Aktiv
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
      Behoben
    </span>
  )
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-CH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(value)
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function AnomaliesPage() {
  await requirePermission('module:admin:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServerClient()

  // Fetch active anomalies
  const { data: activeAnomalies } = await supabase
    .from('anomalies')
    .select('*')
    .eq('company_id', session.companyId)
    .eq('is_active', true)
    .order('detected_at', { ascending: false })

  // Fetch recently resolved anomalies (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: resolvedAnomalies } = await supabase
    .from('anomalies')
    .select('*')
    .eq('company_id', session.companyId)
    .eq('is_active', false)
    .gte('resolved_at', sevenDaysAgo.toISOString())
    .order('resolved_at', { ascending: false })
    .limit(50)

  const active = (activeAnomalies ?? []) as Array<Record<string, unknown>>
  const resolved = (resolvedAnomalies ?? []) as Array<Record<string, unknown>>

  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text-primary">
          Anomalie-Erkennung
        </h1>
        <p className="mt-1 text-sm text-brand-text-secondary">
          Automatisch erkannte Abweichungen und Warnungen für Ihre KPIs und Systeme.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-brand border border-gray-200 bg-brand-surface p-4">
          <p className="text-sm font-medium text-brand-text-secondary">Aktive Anomalien</p>
          <p className="mt-1 text-2xl font-bold text-brand-text-primary">{active.length}</p>
        </div>
        <div className="rounded-brand border border-gray-200 bg-brand-surface p-4">
          <p className="text-sm font-medium text-brand-text-secondary">Kritisch</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {active.filter((a) => a['severity'] === 'critical').length}
          </p>
        </div>
        <div className="rounded-brand border border-gray-200 bg-brand-surface p-4">
          <p className="text-sm font-medium text-brand-text-secondary">Behoben (7 Tage)</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{resolved.length}</p>
        </div>
      </div>

      {/* Active anomalies */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-brand-text-primary">
          Aktive Anomalien
        </h2>
        {active.length === 0 ? (
          <div className="rounded-brand border border-gray-200 bg-brand-surface p-8 text-center">
            <p className="text-sm text-brand-text-secondary">
              Keine aktiven Anomalien erkannt. Alle Systeme arbeiten normal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-brand border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Typ</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Schweregrad</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Metrik</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Aktuell / Basis</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Nachricht</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Erkannt am</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {active.map((anomaly) => {
                  const type = anomaly['type'] as AnomalyType
                  const severity = anomaly['severity'] as AnomalySeverity
                  return (
                    <tr
                      key={anomaly['id'] as string}
                      className={
                        severity === 'critical'
                          ? 'bg-red-50/50'
                          : severity === 'warning'
                            ? 'bg-yellow-50/30'
                            : ''
                      }
                    >
                      <td className="px-4 py-3 font-medium text-brand-text-primary">
                        {ANOMALY_TYPE_LABELS[type] ?? type}
                        {(anomaly['entity_name'] as string) && (
                          <span className="mt-0.5 block text-xs text-brand-text-secondary">
                            {anomaly['entity_name'] as string}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={severity} />
                      </td>
                      <td className="px-4 py-3 text-brand-text-secondary">
                        {anomaly['metric'] as string}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        <span className="font-semibold text-brand-text-primary">
                          {formatNumber(anomaly['current_value'] as number)}
                        </span>
                        <span className="text-brand-text-secondary"> / </span>
                        <span className="text-brand-text-secondary">
                          {formatNumber(anomaly['baseline_value'] as number)}
                        </span>
                        <span
                          className={`ml-2 text-xs ${
                            (anomaly['deviation_pct'] as number) < 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {(anomaly['deviation_pct'] as number) > 0 ? '+' : ''}
                          {(anomaly['deviation_pct'] as number).toFixed(1)}%
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-brand-text-secondary">
                        <span className="line-clamp-2">{anomaly['message'] as string}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-brand-text-secondary">
                        {formatTimestamp(anomaly['detected_at'] as string)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={true} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recently resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-brand-text-primary">
            Kuerzlich behoben (letzte 7 Tage)
          </h2>
          <div className="overflow-x-auto rounded-brand border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Typ</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Schweregrad</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Metrik</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Aktuell / Basis</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Nachricht</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Erkannt am</th>
                  <th className="px-4 py-3 font-medium text-brand-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resolved.map((anomaly) => {
                  const type = anomaly['type'] as AnomalyType
                  const severity = anomaly['severity'] as AnomalySeverity
                  return (
                    <tr key={anomaly['id'] as string} className="opacity-70">
                      <td className="px-4 py-3 font-medium text-brand-text-primary">
                        {ANOMALY_TYPE_LABELS[type] ?? type}
                        {(anomaly['entity_name'] as string) && (
                          <span className="mt-0.5 block text-xs text-brand-text-secondary">
                            {anomaly['entity_name'] as string}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={severity} />
                      </td>
                      <td className="px-4 py-3 text-brand-text-secondary">
                        {anomaly['metric'] as string}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        <span className="font-semibold text-brand-text-primary">
                          {formatNumber(anomaly['current_value'] as number)}
                        </span>
                        <span className="text-brand-text-secondary"> / </span>
                        <span className="text-brand-text-secondary">
                          {formatNumber(anomaly['baseline_value'] as number)}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-brand-text-secondary">
                        <span className="line-clamp-2">{anomaly['message'] as string}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-brand-text-secondary">
                        {formatTimestamp(anomaly['detected_at'] as string)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={false} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
