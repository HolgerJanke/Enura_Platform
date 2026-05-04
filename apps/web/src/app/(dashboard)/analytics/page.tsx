export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { KPI_SNAPSHOT_TYPES } from '@enura/types'
import type { OfferRow, TeamMemberRow } from '@enura/types'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string
  value: string | number
  trend?: string
  trendUp?: boolean
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
      <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-brand-text-primary">{value}</p>
        {trend && (
          <span className={`text-xs font-medium mb-1 ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session?.companyId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Nicht angemeldet.</p>
      </div>
    )
  }

  const db = getDataAccess()

  const [snapshot, offers, teamMembers] = await Promise.all([
    db.kpis.findLatest(session.companyId, KPI_SNAPSHOT_TYPES.TENANT_DAILY_SUMMARY),
    db.offers.findMany(session.companyId),
    db.teamMembers.findByCompanyId(session.companyId),
  ])

  const metrics = (snapshot?.metrics ?? {}) as Record<string, unknown>

  // KPI values
  const pipelineValue = typeof metrics['pipeline_value'] === 'number'
    ? `CHF ${((metrics['pipeline_value'] as number) / 1_000_000).toFixed(1)}M`
    : 'CHF 0'
  const wonCount = typeof metrics['won_count'] === 'number' ? metrics['won_count'] as number : 0
  const lostCount = typeof metrics['lost_count'] === 'number' ? metrics['lost_count'] as number : 0
  const totalOffers = offers.length

  // Win rate
  const winRate = wonCount + lostCount > 0
    ? `${Math.round((wonCount / (wonCount + lostCount)) * 100)}%`
    : '—'

  // Top sellers by number of won offers
  const wonOffers = offers.filter((o: OfferRow) => o.status === 'won')
  const sellerCounts: Record<string, number> = {}
  for (const o of wonOffers) {
    const bid = (o as OfferRow).berater_id
    if (bid) sellerCounts[bid] = (sellerCounts[bid] ?? 0) + 1
  }
  const topSellerIds = Object.entries(sellerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const memberMap = new Map(teamMembers.map((m: TeamMemberRow) => [m.id, m]))

  // Monthly offer counts (simple aggregation by created_at month)
  const monthCounts: Record<string, number> = {}
  for (const o of offers) {
    const d = new Date((o as OfferRow).created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthCounts[key] = (monthCounts[key] ?? 0) + 1
  }
  const sortedMonths = Object.entries(monthCounts).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
  const maxMonthCount = Math.max(...sortedMonths.map(([, v]) => v), 1)

  // Pipeline funnel
  const phases = [
    { label: 'Entwurf', key: 'draft' },
    { label: 'Versendet', key: 'sent' },
    { label: 'Gewonnen', key: 'won' },
    { label: 'Verloren', key: 'lost' },
  ]
  const phaseCounts = phases.map((p) => ({
    ...p,
    count: offers.filter((o: OfferRow) => o.status === p.key).length,
  }))
  const maxPhaseCount = Math.max(...phaseCounts.map((p) => p.count), 1)

  const monthNames: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mär', '04': 'Apr', '05': 'Mai', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez',
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Analytics</h1>
          <p className="text-sm text-brand-text-secondary mt-1">Performance-Übersicht und Kennzahlen</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-white border border-gray-200 p-1">
          {['7 Tage', '30 Tage', 'Quartal', 'Jahr'].map((tab, i) => (
            <button
              key={tab}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                i === 1 ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pipeline-Wert" value={pipelineValue} trend="+12%" trendUp={true} />
        <KpiCard label="Abschlüsse" value={wonCount} trend="+8%" trendUp={true} />
        <KpiCard label="Abschlussquote" value={winRate} trend="-2%" trendUp={false} />
        <KpiCard label="Angebote Total" value={totalOffers} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Angebote pro Monat */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Angebote pro Monat</h2>
          <div className="flex items-end gap-3 h-40">
            {sortedMonths.map(([month, count]) => {
              const monthKey = month.split('-')[1] ?? '01'
              const heightPct = (count / maxMonthCount) * 100
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[11px] font-medium text-brand-text-primary">{count}</span>
                  <div
                    className="w-full rounded-t-md bg-brand-primary/80"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[10px] text-brand-text-secondary">{monthNames[monthKey] ?? monthKey}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Pipeline-Funnel</h2>
          <div className="space-y-3">
            {phaseCounts.map((phase) => {
              const widthPct = (phase.count / maxPhaseCount) * 100
              return (
                <div key={phase.key} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-brand-text-secondary text-right shrink-0">{phase.label}</span>
                  <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className={`h-full rounded-md transition-all ${
                        phase.key === 'won' ? 'bg-green-500' : phase.key === 'lost' ? 'bg-red-400' : 'bg-brand-primary/70'
                      }`}
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-brand-text-primary w-10 text-right">{phase.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top Sellers + Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Verkäufer */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Top Verkäufer</h2>
          {topSellerIds.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-text-secondary border-b border-gray-100">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium text-right">Abschlüsse</th>
                </tr>
              </thead>
              <tbody>
                {topSellerIds.map(([id, count], idx) => {
                  const member = memberMap.get(id)
                  return (
                    <tr key={id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 text-brand-text-primary">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-semibold text-brand-primary">
                            {idx + 1}
                          </span>
                          {member ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() : id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-brand-text-primary">{count}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-brand-text-secondary">Keine Daten vorhanden.</p>
          )}
        </div>

        {/* Quick links to detailed analytics */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Detail-Analysen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Setter-Performance', href: '/setter', color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { label: 'Berater-Performance', href: '/berater', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
              { label: 'Lead-Kontrolle', href: '/leads', color: 'bg-green-50 text-green-700 border-green-100' },
              { label: 'Anomalien', href: '/anomalies', color: 'bg-amber-50 text-amber-700 border-amber-100' },
              { label: 'Tagesberichte', href: '/reports', color: 'bg-purple-50 text-purple-700 border-purple-100' },
              { label: 'Cashflow', href: '/cashflow-gantt', color: 'bg-teal-50 text-teal-700 border-teal-100' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all hover:shadow-sm ${item.color}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
