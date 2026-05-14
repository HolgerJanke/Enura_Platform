export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense } from 'react'
import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  formatPercent,
  formatCHF,
  formatNumber,
  formatDate,
  KPI_SNAPSHOT_TYPES,
} from '@enura/types'
import type { BeraterDailyMetrics, OfferRow } from '@enura/types'
import { TeamMemberFilter } from '@/components/team-member-filter'

export default async function BeraterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('module:berater:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const sp = await searchParams
  const selectedMember = typeof sp['member'] === 'string' ? sp['member'] : ''

  const serviceDb = createSupabaseServiceClient()
  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!
  const cid = session.companyId

  // Fetch berater team members from team_members (profiles table is empty)
  const { data: beraterMembers } = await serviceDb
    .from('team_members')
    .select('id, display_name, first_name, last_name, is_active')
    .eq('company_id', cid)
    .eq('is_active', true)
    .order('display_name')

  const beraters = (beraterMembers ?? []) as Array<{ id: string; display_name: string }>
  const memberMap = new Map((beraterMembers ?? []).map((m: Record<string, unknown>) => [m.id as string, m]))

  // Use optimized count queries instead of fetching all rows (Supabase limit is 1000)
  const buildCountQuery = (status?: string) => {
    let q = serviceDb
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', cid)
    if (status) q = q.eq('status', status)
    if (selectedMember) q = q.eq('berater_id', selectedMember)
    return q
  }

  const [
    { count: totalOffers },
    { count: wonCount },
    { count: lostCount },
    { count: draftCount },
  ] = await Promise.all([
    buildCountQuery(),
    buildCountQuery('won'),
    buildCountQuery('lost'),
    buildCountQuery('draft'),
  ])

  const total = totalOffers ?? 0
  const won = wonCount ?? 0
  const lost = lostCount ?? 0
  const draft = draftCount ?? 0

  const closingRate = won + lost > 0 ? won / (won + lost) : 0

  // Pipeline value and won revenue via direct queries
  let pipelineQuery = serviceDb
    .from('offers')
    .select('amount_chf')
    .eq('company_id', cid)
    .not('status', 'in', '("won","lost","expired")')
  if (selectedMember) pipelineQuery = pipelineQuery.eq('berater_id', selectedMember)

  let wonRevenueQuery = serviceDb
    .from('offers')
    .select('amount_chf')
    .eq('company_id', cid)
    .eq('status', 'won')
  if (selectedMember) wonRevenueQuery = wonRevenueQuery.eq('berater_id', selectedMember)

  const [{ data: pipelineRows }, { data: wonRevenueRows }] = await Promise.all([
    pipelineQuery,
    wonRevenueQuery,
  ])

  const pipelineValue = (pipelineRows ?? []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + (Number(r.amount_chf) || 0), 0
  )
  const wonRevenue = (wonRevenueRows ?? []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + (Number(r.amount_chf) || 0), 0
  )

  // This week's offers count
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)

  let weekQuery = serviceDb
    .from('offers')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', cid)
    .gte('created_at', weekStart.toISOString())
  if (selectedMember) weekQuery = weekQuery.eq('berater_id', selectedMember)
  const { count: thisWeekCount } = await weekQuery

  // Monthly revenue trend from won offers (fetch only amount + date)
  let wonOffersQuery = serviceDb
    .from('offers')
    .select('amount_chf, created_at')
    .eq('company_id', cid)
    .eq('status', 'won')
  if (selectedMember) wonOffersQuery = wonOffersQuery.eq('berater_id', selectedMember)
  const { data: wonOffersData } = await wonOffersQuery

  const monthRevenue: Record<string, number> = {}
  const monthWonCount: Record<string, number> = {}
  for (const o of wonOffersData ?? []) {
    const row = o as { amount_chf: number; created_at: string }
    const d = new Date(row.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthRevenue[key] = (monthRevenue[key] ?? 0) + (Number(row.amount_chf) || 0)
    monthWonCount[key] = (monthWonCount[key] ?? 0) + 1
  }
  const sortedMonths = Object.entries(monthRevenue)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
  const maxRevenue = Math.max(...sortedMonths.map(([, v]) => v), 1)

  const monthNames: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mär', '04': 'Apr', '05': 'Mai', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez',
  }

  // Top berater by won offers (skip if filtered to single member)
  const beraterWonCounts: Record<string, { won: number; revenue: number }> = {}
  if (!selectedMember) {
    for (const o of wonOffersData ?? []) {
      const row = o as { amount_chf: number; created_at: string; berater_id?: string }
      // Won offers data doesn't include berater_id — fetch separately
    }
  }

  // Fetch top berater separately for the ranking table
  let topBerater: Array<[string, { won: number; revenue: number }]> = []
  if (!selectedMember) {
    const { data: wonWithBerater } = await serviceDb
      .from('offers')
      .select('berater_id, amount_chf')
      .eq('company_id', cid)
      .eq('status', 'won')
      .not('berater_id', 'is', null)

    const counts: Record<string, { won: number; revenue: number }> = {}
    for (const o of wonWithBerater ?? []) {
      const row = o as { berater_id: string; amount_chf: number }
      if (!counts[row.berater_id]) counts[row.berater_id] = { won: 0, revenue: 0 }
      counts[row.berater_id]!.won += 1
      counts[row.berater_id]!.revenue += Number(row.amount_chf) || 0
    }

    topBerater = Object.entries(counts)
      .filter(([id]) => {
        const m = memberMap.get(id) as Record<string, unknown> | undefined
        return m && m.is_active !== false
      })
      .sort((a, b) => b[1].won - a[1].won)
      .slice(0, 8)
  }

  // Format pipeline value
  const pipelineFormatted = pipelineValue > 1_000_000
    ? `CHF ${(pipelineValue / 1_000_000).toFixed(1)}M`
    : formatCHF(pipelineValue)

  const wonRevenueFormatted = wonRevenue > 1_000_000
    ? `CHF ${(wonRevenue / 1_000_000).toFixed(1)}M`
    : formatCHF(wonRevenue)

  return (
    <div className="p-4 sm:p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary">
          Berater Performance
        </h1>
        <Suspense fallback={null}>
          <TeamMemberFilter members={beraters} label="Berater" />
        </Suspense>
      </div>
      <p className="text-brand-text-secondary mb-6">{formatDate(today)}</p>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Gewonnener Umsatz</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {wonRevenueFormatted}
          </p>
          <p className="text-xs text-brand-text-secondary mt-1">{won} Abschlüsse</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Abschlussrate</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatPercent(closingRate)}
          </p>
          <p className="text-xs text-brand-text-secondary mt-1">{won} Gew. / {lost} Verl.</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Pipeline-Wert</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {pipelineFormatted}
          </p>
          <p className="text-xs text-brand-text-secondary mt-1">{draft} Entwürfe offen</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Angebote Total</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(total)}
          </p>
          <p className="text-xs text-brand-text-secondary mt-1">{thisWeekCount ?? 0} diese Woche</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Trend Chart */}
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Umsatz-Trend (gewonnene Angebote)
          </h2>
          {sortedMonths.length > 0 ? (
            <div className="flex items-end gap-2 h-40">
              {sortedMonths.map(([month, revenue]) => {
                const monthKey = month.split('-')[1] ?? '01'
                const heightPct = (revenue / maxRevenue) * 100
                const wonCountForMonth = monthWonCount[month] ?? 0
                const revenueK = revenue >= 1000 ? `${Math.round(revenue / 1000)}k` : Math.round(revenue).toString()
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium text-brand-text-primary">{revenueK}</span>
                    <div
                      className="w-full rounded-t-md"
                      style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: '#10B981', opacity: 0.8 }}
                      title={`${monthNames[monthKey]}: CHF ${Math.round(revenue).toLocaleString('de-CH')} (${wonCountForMonth} Deals)`}
                    />
                    <span className="text-[10px] text-brand-text-secondary">{monthNames[monthKey] ?? monthKey}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-brand-text-secondary">Keine gewonnenen Angebote vorhanden.</p>
          )}
        </div>

        {/* Offers Breakdown */}
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Angebots-Aufschlüsselung
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Entwurf', count: draft, barColor: '#1A56DB' },
              { label: 'Gewonnen', count: won, barColor: '#10B981' },
              { label: 'Verloren', count: lost, barColor: '#F87171' },
            ].map((phase) => {
              const maxCount = Math.max(draft, won, lost, 1)
              const widthPct = (phase.count / maxCount) * 100
              return (
                <div key={phase.label} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-brand-text-secondary text-right shrink-0">{phase.label}</span>
                  <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all"
                      style={{ width: `${Math.max(widthPct, 2)}%`, backgroundColor: phase.barColor, opacity: 0.85 }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-brand-text-primary w-10 text-right">{phase.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top Berater + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Berater Ranking */}
        {!selectedMember && topBerater.length > 0 && (
          <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
            <h2 className="text-lg font-medium text-brand-text-primary mb-4">
              Top Berater (nach Abschlüssen)
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-text-secondary border-b border-gray-100">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium text-right">Deals</th>
                  <th className="pb-2 font-medium text-right">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {topBerater.map(([id, stats], idx) => {
                  const member = memberMap.get(id) as Record<string, unknown> | undefined
                  const name = member
                    ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || (member.display_name as string)
                    : id.slice(0, 8)
                  return (
                    <tr key={id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 text-brand-text-primary">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-semibold text-brand-primary">
                            {idx + 1}
                          </span>
                          {name}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-brand-text-primary">{stats.won}</td>
                      <td className="py-2.5 text-right text-brand-text-secondary text-xs">
                        {stats.revenue > 0 ? formatCHF(stats.revenue) : '--'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Zusammenfassung
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Angebote gesamt</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(total)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Gewonnen</td>
                <td className="py-2 text-right font-medium text-green-600">
                  {formatNumber(won)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Verloren</td>
                <td className="py-2 text-right font-medium text-red-500">
                  {formatNumber(lost)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Entwürfe</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(draft)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Abschlussrate</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatPercent(closingRate)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-brand-text-secondary">Gewonnener Umsatz</td>
                <td className="py-2 text-right font-medium text-green-600">
                  {wonRevenueFormatted}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
