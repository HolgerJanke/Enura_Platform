import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron job: compute and upsert per-tenant KPI snapshots that the
 * dashboards (Lead-Kontrolle, Projects, Berater overview) read from.
 *
 * Triggers:
 * - Vercel Cron (configured in `vercel.json`)
 * - Manual fetch (with CRON_SECRET) for ad-hoc recompute
 *
 * Snapshot types written here (the dashboards read from `kpi_snapshots`
 * with these `snapshot_type` values):
 *   - leads_daily            — per-tenant lead counts/funnel
 *   - projects_daily         — per-tenant project counts and portfolio
 *   - berater_daily          — per-team-member offer pipeline (entity_id = team_member.id)
 *   - tenant_daily_summary   — combined snapshot for the tenant overview
 *
 * `setter_daily` and `finance_monthly` are NOT computed here yet — those
 * depend on telephony call data and accounting aggregation,
 * which are scheduled to follow once the connectors are wired up.
 */

type Row = Record<string, unknown>

function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const v = String(r[key] ?? 'unknown')
    out[v] = (out[v] ?? 0) + 1
  }
  return out
}

function sumBy(rows: Row[], key: string): number {
  let total = 0
  for (const r of rows) {
    const v = Number(r[key])
    if (Number.isFinite(v)) total += v
  }
  return total
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]!
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999)

  const summary: Array<Record<string, unknown>> = []

  const { data: companies, error: companiesError } = await db
    .from('companies')
    .select('id, name')
    .eq('status', 'active')

  if (companiesError) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 })
  }

  for (const c of (companies ?? []) as Row[]) {
    const companyId = c['id'] as string
    const companyName = (c['name'] as string) ?? 'unknown'

    // ----- LEADS -----
    const { data: leads } = await db
      .from('leads')
      .select('id, status, source, created_at')
      .eq('company_id', companyId)

    const leadsList = (leads ?? []) as Row[]
    const leadsToday = leadsList.filter((l) => {
      const t = new Date(l['created_at'] as string).getTime()
      return t >= dayStart.getTime() && t <= dayEnd.getTime()
    })

    const leadsMetrics = {
      total: leadsList.length,
      new_today: leadsToday.length,
      by_status: countBy(leadsList, 'status'),
      by_source: countBy(leadsList, 'source'),
    }

    await db.from('kpi_snapshots').upsert({
      company_id: companyId,
      snapshot_type: 'leads_daily',
      entity_id: null,
      period_date: today,
      metrics: leadsMetrics,
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

    // ----- PROJECTS -----
    const { data: projects } = await db
      .from('projects')
      .select('id, status, project_value, current_step_id')
      .eq('company_id', companyId)

    const projectsList = (projects ?? []) as Row[]
    const projectsMetrics = {
      total: projectsList.length,
      active: projectsList.filter((p) => p['status'] === 'active').length,
      total_value: sumBy(projectsList, 'project_value'),
      by_step: countBy(projectsList, 'current_step_id'),
      by_status: countBy(projectsList, 'status'),
    }

    await db.from('kpi_snapshots').upsert({
      company_id: companyId,
      snapshot_type: 'projects_daily',
      entity_id: null,
      period_date: today,
      metrics: projectsMetrics,
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

    // ----- BERATER (per team_member with offers) -----
    // Instead of filtering by role_type (real data uses editor/admin/setter/viewer),
    // find all active team members who actually have offers assigned via berater_id.
    const { data: members } = await db
      .from('team_members')
      .select('id, role_type, display_name')
      .eq('company_id', companyId)
      .eq('is_active', true)

    const allMembers = (members ?? []) as Row[]
    let beraterSnapshotsWritten = 0

    for (const b of allMembers) {
      const memberId = b['id'] as string

      const { data: offers } = await db
        .from('offers')
        .select('id, status, amount_chf, created_at')
        .eq('company_id', companyId)
        .eq('berater_id', memberId)

      const offersList = (offers ?? []) as Row[]
      // Skip members with no offers — they aren't acting as berater
      if (offersList.length === 0) continue

      const won = offersList.filter((o) => String(o['status']).toLowerCase() === 'won')
      const lost = offersList.filter((o) => String(o['status']).toLowerCase() === 'lost')
      const open = offersList.filter((o) => {
        const s = String(o['status']).toLowerCase()
        return s !== 'won' && s !== 'lost' && s !== 'expired'
      })

      const beraterMetrics = {
        offers_total: offersList.length,
        offers_open: open.length,
        offers_won: won.length,
        offers_lost: lost.length,
        total_value: sumBy(offersList, 'amount_chf'),
        won_value: sumBy(won, 'amount_chf'),
        pipeline_value: sumBy(open, 'amount_chf'),
        win_rate: (won.length + lost.length) > 0
          ? Math.round((won.length / (won.length + lost.length)) * 1000) / 10
          : 0,
      }

      await db.from('kpi_snapshots').upsert({
        company_id: companyId,
        snapshot_type: 'berater_daily',
        entity_id: memberId,
        period_date: today,
        metrics: beraterMetrics,
      }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

      beraterSnapshotsWritten++
    }

    // ----- SETTER DAILY (calls & appointments) -----
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const setterMembers = allMembers.filter((m) =>
      m['role_type'] === 'setter' || m['role_type'] === 'admin'
    )
    let setterSnapshotsWritten = 0

    for (const s of setterMembers) {
      const setterId = s['id'] as string

      const { data: calls } = await db
        .from('calls')
        .select('id, status, duration_seconds, direction')
        .eq('company_id', companyId)
        .eq('team_member_id', setterId)
        .gte('started_at', thirtyDaysAgo.toISOString())

      const callsList = (calls ?? []) as Row[]
      if (callsList.length === 0) continue

      const answered = callsList.filter((c) => c['status'] === 'answered')
      const missed = callsList.filter((c) => c['status'] === 'missed' || c['status'] === 'no-answer')
      const totalDuration = sumBy(callsList, 'duration_seconds')
      const avgDuration = answered.length > 0 ? Math.round(totalDuration / answered.length) : 0

      // Count appointments from leads
      const { count: appointmentCount } = await db
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('setter_id', setterId)
        .in('status', ['appointment_set', 'appointment_booked'])

      const setterMetrics = {
        calls_total: callsList.length,
        calls_answered: answered.length,
        calls_missed: missed.length,
        reach_rate: callsList.length > 0 ? Math.round((answered.length / callsList.length) * 1000) / 10 : 0,
        appointments_booked: appointmentCount ?? 0,
        appointment_rate: callsList.length > 0
          ? Math.round(((appointmentCount ?? 0) / callsList.length) * 1000) / 10
          : 0,
        avg_duration_sec: avgDuration,
        total_duration_sec: totalDuration,
      }

      await db.from('kpi_snapshots').upsert({
        company_id: companyId,
        snapshot_type: 'setter_daily',
        entity_id: setterId,
        period_date: today,
        metrics: setterMetrics,
      }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

      setterSnapshotsWritten++
    }

    // ----- OFFERS AGGREGATE (company-wide, using COUNT queries) -----
    const [
      { count: offersTotal },
      { count: offersWon },
      { count: offersLost },
      { count: offersOpen },
    ] = await Promise.all([
      db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'won'),
      db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'lost'),
      db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('status', 'in', '("won","lost","expired")'),
    ])

    // Fetch amounts for pipeline and won revenue (these need actual values)
    const { data: pipelineAmounts } = await db
      .from('offers')
      .select('amount_chf')
      .eq('company_id', companyId)
      .not('status', 'in', '("won","lost","expired")')
      .limit(5000)

    const { data: wonAmounts } = await db
      .from('offers')
      .select('amount_chf')
      .eq('company_id', companyId)
      .eq('status', 'won')
      .limit(5000)

    const pipelineVal = sumBy((pipelineAmounts ?? []) as Row[], 'amount_chf')
    const wonRev = sumBy((wonAmounts ?? []) as Row[], 'amount_chf')

    const oTotal = offersTotal ?? 0
    const oWon = offersWon ?? 0
    const oLost = offersLost ?? 0
    const oOpen = offersOpen ?? 0

    const offersMetrics = {
      total: oTotal,
      won: oWon,
      lost: oLost,
      open: oOpen,
      pipeline_value: pipelineVal,
      won_revenue: wonRev,
      win_rate: (oWon + oLost) > 0
        ? Math.round((oWon / (oWon + oLost)) * 1000) / 10
        : 0,
    }

    // ----- CALLS AGGREGATE -----
    const { data: allCalls } = await db
      .from('calls')
      .select('id, status, duration_seconds')
      .eq('company_id', companyId)
      .gte('started_at', thirtyDaysAgo.toISOString())

    const allCallsList = (allCalls ?? []) as Row[]
    const callsMetrics = {
      total_30d: allCallsList.length,
      answered: allCallsList.filter((c) => c['status'] === 'answered').length,
      missed: allCallsList.filter((c) => c['status'] === 'missed' || c['status'] === 'no-answer').length,
      total_duration_sec: sumBy(allCallsList, 'duration_seconds'),
    }

    // ----- TENANT DAILY SUMMARY -----
    await db.from('kpi_snapshots').upsert({
      company_id: companyId,
      snapshot_type: 'tenant_daily_summary',
      entity_id: null,
      period_date: today,
      metrics: {
        leads: leadsMetrics,
        projects: projectsMetrics,
        offers: offersMetrics,
        calls: callsMetrics,
        beraters_active: beraterSnapshotsWritten,
        setters_active: setterSnapshotsWritten,
      },
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

    summary.push({
      company: companyName,
      leads_total: leadsList.length,
      leads_new_today: leadsToday.length,
      projects_total: projectsList.length,
      offers_total: oTotal,
      berater_snapshots: beraterSnapshotsWritten,
      setter_snapshots: setterSnapshotsWritten,
    })
  }

  return NextResponse.json({
    success: true,
    date: today,
    companies_processed: (companies ?? []).length,
    summary,
  })
}
