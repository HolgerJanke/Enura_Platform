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

  // Fetch berater team members
  const serviceDb = createSupabaseServiceClient()
  const { data: beraterProfiles } = await serviceDb
    .from('profiles')
    .select('id, display_name')
    .eq('company_id', session.companyId)
    .eq('is_active', true)
    .order('display_name')

  const beraters = (beraterProfiles ?? []) as Array<{ id: string; display_name: string }>

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  const snapshot = await db.kpis.findLatest(
    session.companyId,
    KPI_SNAPSHOT_TYPES.BERATER_DAILY,
  )

  let metrics = snapshot?.metrics as BeraterDailyMetrics | undefined

  // If no KPI snapshot exists, compute real-time from offers + leads
  if (!metrics) {
    const [allOffers, leadsResult] = await Promise.all([
      db.offers.findMany(session.companyId, selectedMember ? { beraterId: selectedMember } : undefined),
      db.leads.count(session.companyId, { status: 'appointment_booked' }),
    ])

    // This week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    // Filter for selected berater if needed
    const relevantOffers = selectedMember
      ? allOffers.filter((o: OfferRow) => o.berater_id === selectedMember)
      : allOffers

    const wonOffers = relevantOffers.filter((o: OfferRow) => o.status === 'won')
    const lostOffers = relevantOffers.filter((o: OfferRow) => o.status === 'lost')
    const closingRate = wonOffers.length + lostOffers.length > 0
      ? wonOffers.length / (wonOffers.length + lostOffers.length)
      : 0

    const pipelineValue = relevantOffers
      .filter((o: OfferRow) => !['won', 'lost', 'expired'].includes(o.status))
      .reduce((sum: number, o: OfferRow) => sum + (Number(o.amount_chf) || 0), 0)

    // Calculate weekly appointments from leads with appointment statuses
    let weeklyAppointmentsQuery = serviceDb
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', session.companyId)
      .in('status', ['appointment_set', 'appointment_booked'])
      .gte('updated_at', weekStart.toISOString())

    const { count: weeklyAppointments } = await weeklyAppointmentsQuery

    // Calculate avg deal duration from won offers
    const dealDurations = wonOffers
      .filter((o: OfferRow) => o.decided_at && o.created_at)
      .map((o: OfferRow) => {
        const created = new Date(o.created_at)
        const decided = new Date(o.decided_at!)
        return Math.floor((decided.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      })
    const avgDealDuration = dealDurations.length > 0
      ? Math.round(dealDurations.reduce((a, b) => a + b, 0) / dealDurations.length)
      : null

    // This week's offers
    const thisWeekOffers = relevantOffers.filter((o: OfferRow) => new Date(o.created_at) >= weekStart)

    metrics = {
      appointments_total: weeklyAppointments ?? 0,
      appointments_done: weeklyAppointments ?? 0,
      appointments_no_show: 0,
      closing_rate: closingRate,
      pipeline_value_chf: pipelineValue,
      offers_created: thisWeekOffers.length,
      offers_won: wonOffers.length,
      avg_deal_duration_days: avgDealDuration,
      activities_total: relevantOffers.length,
    }
  }

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Termine diese Woche
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.appointments_total ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Abschlussrate</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatPercent(metrics?.closing_rate ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Angebotsvolumen
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatCHF(metrics?.pipeline_value_chf ?? 0)}
          </p>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Durchgeführte Termine
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.appointments_done ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">No-Shows</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.appointments_no_show ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Durchschnittl. Deal-Dauer
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {metrics?.avg_deal_duration_days !== null
              ? `${metrics?.avg_deal_duration_days ?? 0} Tage`
              : '--'}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Angebote total
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.activities_total ?? 0)}
          </p>
        </div>
      </div>

      {/* Offers breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Angebote
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Erstellt</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.offers_created ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Gewonnen</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.offers_won ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-brand-text-secondary">
                  Abschlussrate
                </td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatPercent(metrics?.closing_rate ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Umsatz-Trend
          </h2>
          <p className="text-sm text-brand-text-secondary">
            Trend-Diagramm wird mit dem Chart-Modul integriert.
          </p>
        </div>
      </div>
    </div>
  )
}
