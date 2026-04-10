import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireEnuraAdmin } from '@/lib/permissions'

type PlatformMetric = {
  measured_at: string
  total_holdings: number
  active_holdings: number
  total_companies: number
  total_users: number
  ai_calls_24h: number
  deployments_24h: number
}

type ServiceStatus = {
  name: string
  status: 'operational' | 'degraded' | 'down'
  latency: string
}

// Mock queue data until real BullMQ integration
const MOCK_QUEUES = [
  { name: 'connector-sync', waiting: 3, active: 1, completed: 247, failed: 2 },
  { name: 'kpi-snapshot', waiting: 0, active: 0, completed: 96, failed: 0 },
  { name: 'email-report', waiting: 1, active: 0, completed: 12, failed: 0 },
  { name: 'call-analysis', waiting: 5, active: 2, completed: 184, failed: 4 },
]

// Mock service statuses
const MOCK_SERVICES: ServiceStatus[] = [
  { name: 'Supabase (Datenbank)', status: 'operational', latency: '12ms' },
  { name: 'Supabase Auth', status: 'operational', latency: '45ms' },
  { name: 'Redis (Cache)', status: 'operational', latency: '3ms' },
  { name: 'Anthropic API', status: 'operational', latency: '320ms' },
  { name: 'Resend (E-Mail)', status: 'operational', latency: '89ms' },
  { name: 'Supabase Storage', status: 'operational', latency: '28ms' },
]

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; bgClass: string }> = {
  operational: { label: 'Betriebsbereit', dotClass: 'bg-green-500', bgClass: 'bg-green-50 text-green-700' },
  degraded: { label: 'Beeintraechtigt', dotClass: 'bg-yellow-500', bgClass: 'bg-yellow-50 text-yellow-700' },
  down: { label: 'Ausgefallen', dotClass: 'bg-red-500', bgClass: 'bg-red-50 text-red-700' },
}

async function getMetricsHistory(): Promise<PlatformMetric[]> {
  const supabase = createSupabaseServerClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('platform_metrics')
    .select('*')
    .gte('measured_at', thirtyDaysAgo.toISOString())
    .order('measured_at', { ascending: true })

  return (data ?? []) as PlatformMetric[]
}

export default async function HealthPage() {
  await requireEnuraAdmin()

  const metricsHistory = await getMetricsHistory()

  // Compute summary from latest metric
  const latest = metricsHistory.length > 0
    ? metricsHistory[metricsHistory.length - 1]
    : null

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Plattform-Gesundheit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Systemstatus, Warteschlangen und Plattform-Metriken
        </p>
      </div>

      {/* Service Status Grid */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Dienste</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_SERVICES.map((service) => {
            const config = STATUS_CONFIG[service.status]
            return (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${config?.dotClass ?? ''}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{service.name}</p>
                    <p className="text-xs text-gray-500">Latenz: {service.latency}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config?.bgClass ?? ''}`}>
                  {config?.label ?? service.status}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Queue Monitor */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Warteschlangen</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Warteschlange
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Wartend
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Aktiv
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Abgeschlossen
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fehlgeschlagen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {MOCK_QUEUES.map((queue) => (
                <tr key={queue.name} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {queue.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {queue.waiting}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {queue.active}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-green-700">
                    {queue.completed}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-red-700">
                    {queue.failed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Platform Metrics Summary */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Plattform-Metriken (letzte 30 Tage)</h2>
        {latest ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Holdings gesamt" value={latest.total_holdings} />
            <MetricCard label="Aktive Holdings" value={latest.active_holdings} />
            <MetricCard label="Unternehmen gesamt" value={latest.total_companies} />
            <MetricCard label="Benutzer gesamt" value={latest.total_users} />
            <MetricCard label="KI-Aufrufe (24h)" value={latest.ai_calls_24h} />
            <MetricCard label="Deployments (24h)" value={latest.deployments_24h} />
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">Noch keine Metriken vorhanden.</p>
          </div>
        )}

        {/* Simple chart representation */}
        {metricsHistory.length > 1 && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-medium text-gray-700">Benutzer-Entwicklung</h3>
            <div className="flex h-40 items-end gap-1">
              {metricsHistory.slice(-30).map((m, i) => {
                const maxUsers = Math.max(...metricsHistory.map((x) => x.total_users), 1)
                const heightPercent = (m.total_users / maxUsers) * 100
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-blue-500 transition-all"
                    style={{ height: `${heightPercent}%` }}
                    title={`${new Date(m.measured_at).toLocaleDateString('de-CH')}: ${m.total_users} Benutzer`}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>Vor 30 Tagen</span>
              <span>Heute</span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
