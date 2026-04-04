import { requirePermission, checkPermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  formatPercent,
  formatDuration,
  formatDate,
  formatNumber,
  KPI_SNAPSHOT_TYPES,
} from '@enura/types'
import type { SetterDailyMetrics } from '@enura/types'
import { RecentCallsTable } from '@/components/calls/recent-calls-table'

export default async function SetterPage() {
  await requirePermission('module:setter:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  // Get today's snapshot
  const snapshot = await db.kpis.findLatest(
    session.companyId,
    KPI_SNAPSHOT_TYPES.SETTER_DAILY,
  )

  const metrics = snapshot?.metrics as SetterDailyMetrics | undefined

  // Fetch recent calls (last 30 days, limited to 20)
  const supabase = createSupabaseServerClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentCalls } = await supabase
    .from('calls')
    .select(
      'id, started_at, duration_seconds, direction, status, team_member_id, recording_url',
    )
    .eq('company_id', session.companyId)
    .gte('started_at', thirtyDaysAgo.toISOString())
    .order('started_at', { ascending: false })
    .limit(20)

  // Fetch analyses for those calls
  const callIds = (recentCalls ?? []).map(
    (c: Record<string, unknown>) => c['id'] as string,
  )
  const { data: analyses } = callIds.length > 0
    ? await supabase
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
      <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary mb-2">
        Setter Performance
      </h1>
      <p className="text-brand-text-secondary mb-6">{formatDate(today)}</p>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Anrufe heute</p>
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
            Anruf-Aufschluesselung
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
          <p className="text-sm text-brand-text-secondary">
            Trend-Diagramm wird mit dem Chart-Modul integriert.
          </p>
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
