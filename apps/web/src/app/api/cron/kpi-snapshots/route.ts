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
 *   - setter_daily           — per-setter call/appointment KPIs
 *   - finance_daily          — invoice/payment/liquidity aggregates (/finance, /controlling)
 *   - tenant_daily_summary   — combined snapshot (/dashboard, /analytics)
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
    const topSellers: Array<{ id: string; name: string; won: number }> = []

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

      if (won.length > 0) {
        topSellers.push({
          id: memberId,
          name: (b['display_name'] as string | null) ?? '',
          won: won.length,
        })
      }
    }
    topSellers.sort((a, b) => b.won - a.won)

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

    // ----- OFFERS AGGREGATE (company-wide, one pull instead of 6 queries) -----
    const { data: allOffers } = await db
      .from('offers')
      .select('status, amount_chf, created_at')
      .eq('company_id', companyId)
      .limit(10000)

    const offersList = (allOffers ?? []) as Row[]
    const wonOffers = offersList.filter((o) => o['status'] === 'won')
    const openOffers = offersList.filter(
      (o) => !['won', 'lost', 'expired'].includes(String(o['status'])),
    )

    const monthKeyOf = (iso: unknown): string | null => {
      if (typeof iso !== 'string' || !iso) return null
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return null
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    const offersByMonth: Record<string, number> = {}
    const wonRevenueByMonth: Record<string, number> = {}
    for (const o of offersList) {
      const key = monthKeyOf(o['created_at'])
      if (key) offersByMonth[key] = (offersByMonth[key] ?? 0) + 1
    }
    for (const o of wonOffers) {
      const key = monthKeyOf(o['created_at'])
      const amount = Number(o['amount_chf'])
      if (key && Number.isFinite(amount)) {
        wonRevenueByMonth[key] = (wonRevenueByMonth[key] ?? 0) + amount
      }
    }

    const oTotal = offersList.length
    const oWon = wonOffers.length
    const oLost = countBy(offersList, 'status')['lost'] ?? 0

    const offersMetrics = {
      total: oTotal,
      won: oWon,
      lost: oLost,
      open: openOffers.length,
      pipeline_value: sumBy(openOffers, 'amount_chf'),
      won_revenue: sumBy(wonOffers, 'amount_chf'),
      win_rate: (oWon + oLost) > 0
        ? Math.round((oWon / (oWon + oLost)) * 1000) / 10
        : 0,
      by_status: countBy(offersList, 'status'),
      by_month: offersByMonth,
      won_revenue_by_month: wonRevenueByMonth,
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

    // ----- FINANCE DAILY (read by /finance and /controlling) -----
    const [invoicesRes, paymentsRes, incomingRes, liqRes] = await Promise.all([
      db.from('invoices')
        .select('total_chf, status, due_at')
        .eq('company_id', companyId)
        .limit(10000),
      db.from('payments')
        .select('amount_chf')
        .eq('company_id', companyId)
        .limit(10000),
      db.from('invoices_incoming')
        .select('gross_amount, status, due_date')
        .eq('company_id', companyId)
        .limit(10000),
      db.from('liquidity_event_instances')
        .select('direction, budget_amount, budget_date, scheduled_amount, scheduled_date, actual_amount, actual_date')
        .eq('company_id', companyId)
        .eq('marker_type', 'event')
        .order('budget_date')
        .range(0, 4999),
    ])

    const invoicesList = (invoicesRes.data ?? []) as Row[]
    const paymentsList = (paymentsRes.data ?? []) as Row[]
    const incomingList = (incomingRes.data ?? []) as Row[]
    const liqEvents = (liqRes.data ?? []) as Row[]

    const bexioPaid = invoicesList.filter((i) => i['status'] === 'paid')
    const bexioOpen = invoicesList.filter((i) =>
      ['sent', 'overdue', 'partially_paid'].includes(String(i['status'])),
    )
    const bexioOverdue = invoicesList.filter((i) => {
      if (i['status'] === 'overdue') return true
      const due = i['due_at'] as string | null
      return Boolean(
        due && new Date(due) < now &&
        ['sent', 'partially_paid'].includes(String(i['status'])),
      )
    })

    const incomingOpen = incomingList.filter(
      (i) => !['paid', 'returned_formal', 'returned_sender'].includes(String(i['status'])),
    )
    const incomingOverdue = incomingOpen.filter((i) => {
      const due = i['due_date'] as string | null
      return Boolean(due && new Date(due) < now)
    })

    const liquidityForecast = (days: number): number => {
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() + days)
      let cumulative = 0
      for (const evt of liqEvents) {
        const d = (evt['actual_date'] ?? evt['scheduled_date'] ?? evt['budget_date']) as string | null
        if (!d) continue
        if (new Date(d) > cutoff) continue
        const amt = Number(evt['actual_amount'] ?? evt['scheduled_amount'] ?? evt['budget_amount'] ?? 0)
        cumulative += evt['direction'] === 'income' ? amt : -amt
      }
      return cumulative
    }

    const financeMetrics = {
      bexio: {
        invoice_count: invoicesList.length,
        total_invoiced: sumBy(invoicesList, 'total_chf'),
        paid_count: bexioPaid.length,
        total_paid: sumBy(bexioPaid, 'total_chf'),
        open_count: bexioOpen.length,
        total_open: sumBy(bexioOpen, 'total_chf'),
        overdue_count: bexioOverdue.length,
        total_overdue: sumBy(bexioOverdue, 'total_chf'),
        by_status: countBy(invoicesList, 'status'),
        payment_count: paymentsList.length,
        total_payments: sumBy(paymentsList, 'amount_chf'),
      },
      incoming: {
        count: incomingList.length,
        open_count: incomingOpen.length,
        open_amount: sumBy(incomingOpen, 'gross_amount'),
        overdue_count: incomingOverdue.length,
        overdue_amount: sumBy(incomingOverdue, 'gross_amount'),
      },
      liquidity: {
        event_count: liqEvents.length,
        forecast_30: liquidityForecast(30),
        forecast_60: liquidityForecast(60),
        forecast_90: liquidityForecast(90),
      },
    }

    await db.from('kpi_snapshots').upsert({
      company_id: companyId,
      snapshot_type: 'finance_daily',
      entity_id: null,
      period_date: today,
      metrics: financeMetrics,
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

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
        top_sellers: topSellers.slice(0, 10),
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
