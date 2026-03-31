import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireEnuraAdmin } from '@/lib/permissions'
import type { HoldingRow } from '@enura/types'

type HoldingWithCounts = HoldingRow & {
  companies_count: number
  users_count: number
  plan: string
}

async function getMetrics() {
  const supabase = createSupabaseServerClient()

  const { data: metrics } = await supabase
    .from('platform_metrics')
    .select('*')
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    totalHoldings: (metrics as Record<string, number> | null)?.total_holdings ?? 0,
    activeHoldings: (metrics as Record<string, number> | null)?.active_holdings ?? 0,
    totalCompanies: (metrics as Record<string, number> | null)?.total_companies ?? 0,
    aiCalls24h: (metrics as Record<string, number> | null)?.ai_calls_24h ?? 0,
  }
}

async function getHoldings(): Promise<HoldingWithCounts[]> {
  const supabase = createSupabaseServerClient()

  const { data: holdings } = await supabase
    .from('holdings')
    .select('*')
    .order('created_at', { ascending: false })

  if (!holdings) return []

  const holdingIds = holdings.map((h: HoldingRow) => h.id)

  // Fetch company counts per holding
  const { data: companies } = await supabase
    .from('companies')
    .select('id, holding_id')
    .in('holding_id', holdingIds)

  // Fetch user counts per holding
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, holding_id')
    .in('holding_id', holdingIds)

  // Fetch subscriptions
  const { data: subscriptions } = await supabase
    .from('holding_subscriptions')
    .select('holding_id, plan')
    .in('holding_id', holdingIds)

  const companyCounts = new Map<string, number>()
  for (const c of companies ?? []) {
    const hid = (c as { holding_id: string }).holding_id
    companyCounts.set(hid, (companyCounts.get(hid) ?? 0) + 1)
  }

  const userCounts = new Map<string, number>()
  for (const p of profiles ?? []) {
    const hid = (p as { holding_id: string }).holding_id
    if (hid) userCounts.set(hid, (userCounts.get(hid) ?? 0) + 1)
  }

  const planMap = new Map<string, string>()
  for (const s of subscriptions ?? []) {
    const sub = s as { holding_id: string; plan: string }
    planMap.set(sub.holding_id, sub.plan)
  }

  return holdings.map((h: HoldingRow) => ({
    ...h,
    companies_count: companyCounts.get(h.id) ?? 0,
    users_count: userCounts.get(h.id) ?? 0,
    plan: planMap.get(h.id) ?? 'professional',
  }))
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: 'Aktiv', className: 'bg-green-100 text-green-800' },
  suspended: { label: 'Gesperrt', className: 'bg-red-100 text-red-800' },
  archived: { label: 'Archiviert', className: 'bg-gray-100 text-gray-600' },
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  scale: 'Scale',
  enterprise: 'Enterprise',
}

export default async function PlatformOverviewPage() {
  await requireEnuraAdmin()

  const [metrics, holdings] = await Promise.all([getMetrics(), getHoldings()])

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plattform-Uebersicht</h1>
          <p className="mt-1 text-sm text-gray-500">
            Alle Holdings und Unternehmen auf der Enura-Plattform
          </p>
        </div>
        <Link
          href="/platform/holdings/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          aria-label="Neues Holding anlegen"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Holding
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Holdings gesamt" value={metrics.totalHoldings} />
        <MetricCard label="Aktive Holdings" value={metrics.activeHoldings} />
        <MetricCard label="Unternehmen" value={metrics.totalCompanies} />
        <MetricCard label="KI-Aufrufe (24h)" value={metrics.aiCalls24h} />
      </div>

      {/* Holdings Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Unternehmen
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Benutzer
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Plan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Erstellt am
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {holdings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    Noch keine Holdings vorhanden. Erstellen Sie das erste Holding.
                  </td>
                </tr>
              )}
              {holdings.map((holding) => {
                const badge = STATUS_BADGES[holding.status] ?? STATUS_BADGES.active
                return (
                  <tr key={holding.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{holding.name}</p>
                        <p className="text-xs text-gray-500">{holding.slug}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {holding.companies_count}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {holding.users_count}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {PLAN_LABELS[holding.plan] ?? holding.plan}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge?.className ?? ''}`}>
                        {badge?.label ?? holding.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(holding.created_at).toLocaleDateString('de-CH')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/platform/holdings/${holding.id}`}
                          className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          aria-label={`${holding.name} oeffnen`}
                        >
                          Oeffnen
                        </Link>
                        {holding.status === 'active' && (
                          <form action={`/platform/holdings/${holding.id}`}>
                            <button
                              type="button"
                              className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                              aria-label={`${holding.name} sperren`}
                            >
                              Sperren
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
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
