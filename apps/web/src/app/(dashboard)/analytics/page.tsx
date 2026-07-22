export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { KPI_SNAPSHOT_TYPES, parseTenantSummaryMetrics } from '@enura/types'
import type { OfferRow, TeamMemberRow } from '@enura/types'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  accentVar,
}: {
  label: string
  value: string | number
  sub?: string
  accentVar: string
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
      <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-brand-text-primary" style={{ color: `var(${accentVar})` }}>
        {value}
      </p>
      {sub && <p className="text-xs text-brand-text-secondary mt-1">{sub}</p>}
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
  const cid = session.companyId

  // KPIs, monthly trends and top sellers come from the pre-computed
  // snapshot (CLAUDE.md §8) — one query instead of ten raw-table scans.
  const snapshot = await db.kpis.findLatest(cid, KPI_SNAPSHOT_TYPES.TENANT_DAILY_SUMMARY)
  const summary = parseTenantSummaryMetrics(snapshot?.metrics)

  let totalOffers: number
  let wonCount: number
  let lostCount: number
  let draftCount: number
  let sentCount: number
  let pipelineTotal: number
  let totalWonRevenue: number
  let sortedMonths: Array<[string, number]>
  let sortedRevenueMonths: Array<[string, number]>
  let topSellers: Array<{ id: string; name: string; won: number }>

  if (summary) {
    const { offers } = summary
    totalOffers = offers.total
    wonCount = offers.won
    lostCount = offers.lost
    draftCount = offers.by_status['draft'] ?? 0
    sentCount = offers.by_status['sent'] ?? 0
    pipelineTotal = offers.pipeline_value
    totalWonRevenue = offers.won_revenue
    sortedMonths = Object.entries(offers.by_month)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
    sortedRevenueMonths = Object.entries(offers.won_revenue_by_month)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
    topSellers = summary.top_sellers.slice(0, 5)
  } else {
    // No snapshot yet (fresh environment / pre-cron) — compute live once
    const [liveTotal, liveWon, liveLost, liveDraft, liveSent, livePipeline, teamMembers] =
      await Promise.all([
        db.offers.count(cid),
        db.offers.count(cid, { status: 'won' }),
        db.offers.count(cid, { status: 'lost' }),
        db.offers.count(cid, { status: 'draft' }),
        db.offers.count(cid, { status: 'sent' }),
        db.offers.sumAmountChf(cid, { excludeStatus: ['won', 'lost', 'expired'] }),
        db.teamMembers.findByCompanyId(cid),
      ])
    totalOffers = liveTotal
    wonCount = liveWon
    lostCount = liveLost
    draftCount = liveDraft
    sentCount = liveSent
    pipelineTotal = livePipeline

    // Top sellers by number of won offers
    const wonOffersResult = await db.offers.findPaginated(cid, {
      page: 1,
      pageSize: 500,
      status: 'won',
    })
    const sellerCounts: Record<string, number> = {}
    for (const o of wonOffersResult.data) {
      const bid = (o as OfferRow).berater_id
      if (bid) sellerCounts[bid] = (sellerCounts[bid] ?? 0) + 1
    }
    const memberMap = new Map(teamMembers.map((m: TeamMemberRow) => [m.id, m]))
    topSellers = Object.entries(sellerCounts)
      .filter(([id]) => {
        const m = memberMap.get(id)
        if (!m) return false // Unknown member — skip
        return m.is_active !== false
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const m = memberMap.get(id)
        return {
          id,
          name: m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() : '',
          won: count,
        }
      })

    // Monthly offer counts + won revenue trend
    const serviceDb = createSupabaseServiceClient()
    const { data: offerDates } = await serviceDb
      .from('offers')
      .select('amount_chf, created_at, status')
      .eq('company_id', cid)

    const monthCounts: Record<string, number> = {}
    const monthlyRevenue: Record<string, number> = {}
    totalWonRevenue = 0
    for (const o of offerDates ?? []) {
      const row = o as { amount_chf: number; created_at: string; status: string }
      const d = new Date(row.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthCounts[key] = (monthCounts[key] ?? 0) + 1
      if (row.status === 'won') {
        const amount = Number(row.amount_chf) || 0
        monthlyRevenue[key] = (monthlyRevenue[key] ?? 0) + amount
        totalWonRevenue += amount
      }
    }
    sortedMonths = Object.entries(monthCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
    sortedRevenueMonths = Object.entries(monthlyRevenue)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
  }

  // KPI values
  const pipelineValue = pipelineTotal > 1_000_000
    ? `CHF ${(pipelineTotal / 1_000_000).toFixed(1)}M`
    : pipelineTotal > 0
      ? `CHF ${Math.round(pipelineTotal).toLocaleString('de-CH')}`
      : 'CHF 0'

  // Win rate
  const winRate = wonCount + lostCount > 0
    ? `${Math.round((wonCount / (wonCount + lostCount)) * 100)}%`
    : '--'

  const maxMonthCount = Math.max(...sortedMonths.map(([, v]) => v), 1)
  const maxMonthlyRevenue = Math.max(...sortedRevenueMonths.map(([, v]) => v), 1)

  // Pipeline funnel from counts
  const phaseCounts = [
    { label: 'Entwurf', key: 'draft', count: draftCount },
    { label: 'Versendet', key: 'sent', count: sentCount },
    { label: 'Gewonnen', key: 'won', count: wonCount },
    { label: 'Verloren', key: 'lost', count: lostCount },
  ]
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pipeline-Wert" value={pipelineValue} accentVar="--brand-kpi-1" />
        <KpiCard label="Abschlüsse" value={wonCount} sub={`von ${totalOffers} Angeboten`} accentVar="--brand-kpi-2" />
        <KpiCard label="Abschlussquote" value={winRate} sub="Gewonnen / (Gewonnen + Verloren)" accentVar="--brand-kpi-3" />
        <KpiCard label="Angebote Total" value={totalOffers} accentVar="--brand-kpi-1" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Angebote pro Monat */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Angebote pro Monat</h2>
          {sortedMonths.length > 0 ? (
            <div className="relative" style={{ height: '240px' }}>
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none w-8">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-[10px] text-gray-400 text-right pr-1 leading-none">
                    {Math.round(maxMonthCount * (1 - i / 4))}
                  </span>
                ))}
              </div>
              {/* Grid lines */}
              <div className="absolute left-9 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-t border-gray-100 w-full" />
                ))}
              </div>
              {/* Bars */}
              <div className="absolute left-9 right-0 top-0 bottom-6 flex items-end gap-1">
                {sortedMonths.map(([month, count]) => {
                  const monthKey = month.split('-')[1] ?? '01'
                  const heightPct = (count / maxMonthCount) * 100
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10">
                        {count} Angebote
                      </div>
                      <div
                        className="w-full rounded-t-md transition-opacity cursor-default"
                        style={{
                          height: `${Math.max(heightPct, count > 0 ? 2 : 0)}%`,
                          minHeight: count > 0 ? '4px' : '0',
                          backgroundColor: '#1A56DB',
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              {/* Month labels */}
              <div className="absolute left-9 right-0 bottom-0 flex gap-1">
                {sortedMonths.map(([month]) => {
                  const monthKey = month.split('-')[1] ?? '01'
                  return (
                    <div key={month} className="flex-1 text-center">
                      <span className="text-[10px] text-brand-text-secondary font-medium">{monthNames[monthKey] ?? monthKey}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-brand-text-secondary">Keine Daten vorhanden.</p>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Pipeline-Funnel</h2>
          <div className="space-y-4">
            {phaseCounts.map((phase) => {
              const widthPct = (phase.count / maxPhaseCount) * 100
              const barColor = phase.key === 'won'
                ? '#10B981'
                : phase.key === 'lost'
                  ? '#F87171'
                  : phase.key === 'sent'
                    ? '#FBBF24'
                    : '#1A56DB'
              return (
                <div key={phase.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-brand-text-secondary">{phase.label}</span>
                    <span className="text-sm font-bold text-brand-text-primary">{phase.count.toLocaleString('de-CH')}</span>
                  </div>
                  <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg transition-all"
                      style={{
                        width: `${Math.max(widthPct, phase.count > 0 ? 3 : 0)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Umsatz Trend Chart */}
      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-brand-text-primary">Umsatz-Trend (gewonnene Angebote)</h2>
          <span className="text-sm font-bold text-green-600">
            {totalWonRevenue > 1_000_000
              ? `CHF ${(totalWonRevenue / 1_000_000).toFixed(1)}M`
              : totalWonRevenue > 0
                ? `CHF ${Math.round(totalWonRevenue).toLocaleString('de-CH')}`
                : 'CHF 0'}
          </span>
        </div>
        {sortedRevenueMonths.length > 0 ? (
          <div className="relative" style={{ height: '220px' }}>
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none w-12">
              {[...Array(5)].map((_, i) => {
                const val = maxMonthlyRevenue * (1 - i / 4)
                const label = val >= 1_000_000
                  ? `${(val / 1_000_000).toFixed(1)}M`
                  : val >= 1000
                    ? `${Math.round(val / 1000)}k`
                    : Math.round(val).toString()
                return (
                  <span key={i} className="text-[10px] text-gray-400 text-right pr-1 leading-none">
                    {label}
                  </span>
                )
              })}
            </div>
            {/* Grid lines */}
            <div className="absolute left-14 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border-t border-gray-100 w-full" />
              ))}
            </div>
            {/* Bars */}
            <div className="absolute left-14 right-0 top-0 bottom-6 flex items-end gap-1">
              {sortedRevenueMonths.map(([month, revenue]) => {
                const monthKey = month.split('-')[1] ?? '01'
                const heightPct = (revenue / maxMonthlyRevenue) * 100
                const revenueLabel = revenue >= 1000
                  ? `${Math.round(revenue / 1000)}k`
                  : Math.round(revenue).toString()
                return (
                  <div key={month} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10">
                      CHF {Math.round(revenue).toLocaleString('de-CH')}
                    </div>
                    <div
                      className="w-full rounded-t-md cursor-default"
                      style={{
                        height: `${Math.max(heightPct, revenue > 0 ? 3 : 0)}%`,
                        minHeight: revenue > 0 ? '4px' : '0',
                        backgroundColor: '#10B981',
                        opacity: 0.85,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            {/* Month labels */}
            <div className="absolute left-14 right-0 bottom-0 flex gap-1">
              {sortedRevenueMonths.map(([month]) => {
                const monthKey = month.split('-')[1] ?? '01'
                return (
                  <div key={month} className="flex-1 text-center">
                    <span className="text-[10px] text-brand-text-secondary font-medium">{monthNames[monthKey] ?? monthKey}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-brand-text-secondary">Keine gewonnenen Angebote vorhanden.</p>
        )}
      </div>

      {/* Top Sellers + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Verkäufer */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Top Verkäufer</h2>
          {topSellers.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-text-secondary border-b border-gray-100">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium text-right">Abschlüsse</th>
                </tr>
              </thead>
              <tbody>
                {topSellers.map((seller, idx) => (
                  <tr key={seller.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 text-brand-text-primary">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-semibold text-brand-primary">
                          {idx + 1}
                        </span>
                        {seller.name || seller.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-brand-text-primary">{seller.won}</td>
                  </tr>
                ))}
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
              { label: 'Leads & Vertrieb', href: '/leads', color: 'bg-green-50 text-green-700 border-green-100' },
              { label: 'Anomalien', href: '/anomalies', color: 'bg-amber-50 text-amber-700 border-amber-100' },
              { label: 'Tagesberichte', href: '/reports', color: 'bg-purple-50 text-purple-700 border-purple-100' },
              { label: 'Finanzen', href: '/finance', color: 'bg-teal-50 text-teal-700 border-teal-100' },
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
