export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense } from 'react'
import { requirePermission, checkPermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  formatPercent,
  formatDuration,
  formatDate,
  formatNumber,
  KPI_SNAPSHOT_TYPES,
} from '@enura/types'
import type { SetterDailyMetrics } from '@enura/types'
import { RecentCallsTable } from '@/components/calls/recent-calls-table'
import { TeamMemberFilter } from '@/components/team-member-filter'

export default async function SetterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('module:setter:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const sp = await searchParams
  const selectedMember = typeof sp['member'] === 'string' ? sp['member'] : ''

  // Fetch setter team members from team_members (profiles table is empty)
  const serviceDb = createSupabaseServiceClient()
  const { data: setterMembers } = await serviceDb
    .from('team_members')
    .select('id, first_name, last_name, display_name')
    .eq('company_id', session.companyId)
    .eq('is_active', true)
    .in('role_type', ['setter', 'berater', 'admin', 'teamleiter'])
    .order('first_name')

  const setters = (setterMembers ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    display_name: (m.display_name as string)
      || `${(m.first_name as string) ?? ''} ${(m.last_name as string) ?? ''}`.trim()
      || (m.id as string).slice(0, 8),
  }))

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  // Get today's snapshot
  const snapshot = await db.kpis.findLatest(
    session.companyId,
    KPI_SNAPSHOT_TYPES.SETTER_DAILY,
  )

  let metrics = snapshot?.metrics as SetterDailyMetrics | undefined

  // Fetch recent calls (last 30 days, limited to 20)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let callsQuery = serviceDb
    .from('calls')
    .select(
      'id, started_at, duration_seconds, direction, status, team_member_id, recording_url',
    )
    .eq('company_id', session.companyId)
    .gte('started_at', thirtyDaysAgo.toISOString())
    .order('started_at', { ascending: false })
    .limit(20)

  if (selectedMember) {
    callsQuery = callsQuery.eq('team_member_id', selectedMember)
  }

  const { data: recentCalls } = await callsQuery

  // If no KPI snapshot exists, compute real-time metrics from calls data
  if (!metrics) {
    // Use 30-day window for KPIs (not just today — 3CX syncs periodically)
    let monthCallsQuery = serviceDb
      .from('calls')
      .select('id, started_at, duration_seconds, direction, status, team_member_id')
      .eq('company_id', session.companyId)
      .gte('started_at', thirtyDaysAgo.toISOString())

    if (selectedMember) {
      monthCallsQuery = monthCallsQuery.eq('team_member_id', selectedMember)
    }

    const { data: monthCalls } = await monthCallsQuery

    // Count leads with appointment_booked status as proxy for booked appointments
    let appointmentsQuery = serviceDb
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', session.companyId)
      .in('status', ['appointment_set', 'appointment_booked'])

    if (selectedMember) {
      appointmentsQuery = appointmentsQuery.eq('setter_id', selectedMember)
    }

    const { count: appointmentCount } = await appointmentsQuery

    const allCalls = (monthCalls ?? []) as Array<Record<string, unknown>>

    const answered = allCalls.filter((c) => c['status'] === 'answered')
    const missed = allCalls.filter((c) => c['status'] === 'missed' || c['status'] === 'no-answer')
    const voicemail = allCalls.filter((c) => c['status'] === 'voicemail')
    const totalDuration = allCalls.reduce((s, c) => s + (Number(c['duration_seconds']) ?? 0), 0)
    const avgDuration = answered.length > 0
      ? Math.round(totalDuration / answered.length)
      : 0
    const reachRate = allCalls.length > 0 ? answered.length / allCalls.length : 0
    const appointmentRate = allCalls.length > 0 ? (appointmentCount ?? 0) / allCalls.length : 0

    metrics = {
      calls_total: allCalls.length,
      calls_answered: answered.length,
      calls_missed: missed.length,
      calls_voicemail: voicemail.length,
      reach_rate: reachRate,
      appointments_booked: appointmentCount ?? 0,
      appointment_rate: appointmentRate,
      avg_duration_sec: avgDuration,
      total_duration_sec: totalDuration,
      no_show_count: 0,
      no_show_rate: 0,
    }
  }

  // Compute daily call counts for last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  let weekCallsQuery = serviceDb
    .from('calls')
    .select('started_at')
    .eq('company_id', session.companyId)
    .gte('started_at', sevenDaysAgo.toISOString())

  if (selectedMember) {
    weekCallsQuery = weekCallsQuery.eq('team_member_id', selectedMember)
  }

  const { data: weekCalls } = await weekCallsQuery

  const dailyCounts: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyCounts[d.toISOString().split('T')[0]!] = 0
  }
  for (const c of weekCalls ?? []) {
    const day = new Date((c as { started_at: string }).started_at).toISOString().split('T')[0]!
    if (day in dailyCounts) {
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1
    }
  }
  const dailyCountEntries = Object.entries(dailyCounts)
  const maxDailyCount = Math.max(...dailyCountEntries.map(([, v]) => v), 1)

  const dayNames: Record<number, string> = { 0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa' }

  // Fetch analyses for those calls
  const callIds = (recentCalls ?? []).map(
    (c: Record<string, unknown>) => c['id'] as string,
  )
  const { data: analyses } = callIds.length > 0
    ? await serviceDb
        .from('call_analysis')
        .select(
          'call_id, overall_score, greeting_score, needs_analysis_score, presentation_score, closing_score, suggestions, analyzed_at',
        )
        .in('call_id', callIds)
    : { data: [] }

  // Check if current user can override scores (teamleiter or GF)
  const canOverride = await checkPermission('module:setter:write')

  // Normalize call data for the client component
  const callsForTable = (recentCalls ?? []).map((c: Record<string, unknown>) => ({
    id: c['id'] as string,
    started_at: c['started_at'] as string,
    duration_seconds: c['duration_seconds'] as number,
    direction: c['direction'] as string,
    status: c['status'] as string,
    recording_url: (c['recording_url'] as string | null) ?? null,
  }))

  const analysesForTable = (analyses ?? []).map((a: Record<string, unknown>) => ({
    call_id: a['call_id'] as string,
    overall_score: (a['overall_score'] as number | null) ?? null,
    greeting_score: (a['greeting_score'] as number | null) ?? null,
    needs_analysis_score: (a['needs_analysis_score'] as number | null) ?? null,
    presentation_score: (a['presentation_score'] as number | null) ?? null,
    closing_score: (a['closing_score'] as number | null) ?? null,
    suggestions: (a['suggestions'] as Record<string, unknown> | null) ?? null,
    analyzed_at: (a['analyzed_at'] as string | null) ?? null,
  }))

  return (
    <div className="p-4 sm:p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary">
          Setter Performance
        </h1>
        <Suspense fallback={null}>
          <TeamMemberFilter members={setters} label="Setter" />
        </Suspense>
      </div>
      <p className="text-brand-text-secondary mb-6">{formatDate(today)}</p>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Anrufe (30 Tage)</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.calls_total ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Erreichbarkeit</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatPercent(metrics?.reach_rate ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Termine gebucht</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.appointments_booked ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Terminquote</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatPercent(metrics?.appointment_rate ?? 0)}
          </p>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Durchschnittl. Anrufdauer
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatDuration(metrics?.avg_duration_sec ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">No-Show-Rate</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatPercent(metrics?.no_show_rate ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Gesamte Anrufdauer
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatDuration(metrics?.total_duration_sec ?? 0)}
          </p>
        </div>
      </div>

      {/* Call breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Anruf-Aufschlüsselung
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Beantwortet</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.calls_answered ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-secondary">Verpasst</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.calls_missed ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-brand-text-secondary">Voicemail</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatNumber(metrics?.calls_voicemail ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Anrufe letzte 7 Tage
          </h2>
          {dailyCountEntries.some(([, v]) => v > 0) ? (
            <div className="flex items-end gap-2 h-32">
              {dailyCountEntries.map(([date, count]) => {
                const d = new Date(date)
                const heightPct = (count / maxDailyCount) * 100
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[11px] font-medium text-brand-text-primary">{count > 0 ? count : ''}</span>
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%`,
                        backgroundColor: '#1A56DB',
                        opacity: 0.8,
                      }}
                    />
                    <span className="text-[10px] text-brand-text-secondary">{dayNames[d.getDay()] ?? ''}</span>
                    <span className="text-[9px] text-gray-400">{d.getDate()}.{d.getMonth() + 1}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-brand-text-secondary">Keine Anrufe in den letzten 7 Tagen.</p>
          )}
        </div>
      </div>

      {/* Recent calls with analysis */}
      <div>
        <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
          Letzte Anrufe
        </h2>
        <RecentCallsTable
          calls={callsForTable}
          analyses={analysesForTable}
          canOverride={canOverride}
        />
      </div>
    </div>
  )
}
