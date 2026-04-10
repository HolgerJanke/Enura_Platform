import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  SetterDailyMetrics,
  LeadsDailyMetrics,
  FinanceMonthlyMetrics,
  ProjectsDailyMetrics,
  TenantDailySummaryMetrics,
} from '@enura/types'

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function computeSetterDaily(
  companyId: string,
  memberId: string,
  date: Date,
): Promise<SetterDailyMetrics> {
  const client = getServiceClient()
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  // Get calls for this setter on this day
  const { data: calls } = await client
    .from('calls')
    .select('status, duration_seconds')
    .eq('company_id', companyId)
    .eq('team_member_id', memberId)
    .gte('started_at', dayStart.toISOString())
    .lte('started_at', dayEnd.toISOString())

  const callList = calls ?? []
  const total = callList.length
  const answered = callList.filter((c: Record<string, unknown>) => c['status'] === 'answered').length
  const missed = callList.filter((c: Record<string, unknown>) => c['status'] === 'missed').length
  const voicemail = callList.filter((c: Record<string, unknown>) => c['status'] === 'voicemail').length
  const durations = callList
    .filter((c: Record<string, unknown>) => c['status'] === 'answered')
    .map((c: Record<string, unknown>) => (c['duration_seconds'] as number) ?? 0)
  const totalDuration = durations.reduce((a: number, b: number) => a + b, 0)
  const avgDuration = durations.length > 0 ? totalDuration / durations.length : 0

  // Get appointments booked (calendar events)
  const { count: appointmentsBooked } = await client
    .from('calendar_events')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('team_member_id', memberId)
    .gte('starts_at', dayStart.toISOString())
    .lte('starts_at', dayEnd.toISOString())

  return {
    calls_total: total,
    calls_answered: answered,
    calls_missed: missed,
    calls_voicemail: voicemail,
    reach_rate: total > 0 ? answered / total : 0,
    avg_duration_sec: Math.round(avgDuration),
    total_duration_sec: totalDuration,
    appointments_booked: appointmentsBooked ?? 0,
    appointment_rate: answered > 0 ? (appointmentsBooked ?? 0) / answered : 0,
    no_show_count: 0, // Computed when calendar integration is live
    no_show_rate: 0,
  }
}

export async function computeLeadsDaily(
  companyId: string,
  date: Date,
): Promise<LeadsDailyMetrics> {
  const client = getServiceClient()
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const { data: leads } = await client
    .from('leads')
    .select('status, source, created_at')
    .eq('company_id', companyId)
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString())

  const leadList = leads ?? []

  const bySource: Record<string, number> = {}
  for (const lead of leadList) {
    const src = (lead as Record<string, unknown>)['source'] as string ?? 'other'
    bySource[src] = (bySource[src] ?? 0) + 1
  }

  // Count unworked leads (new, created > 4h ago)
  const fourHoursAgo = new Date(date)
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4)
  const { count: unworkedCount } = await client
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'new')
    .lt('created_at', fourHoursAgo.toISOString())

  return {
    leads_new: leadList.filter((l: Record<string, unknown>) => l['status'] === 'new').length,
    leads_qualified: leadList.filter((l: Record<string, unknown>) => l['status'] === 'qualified').length,
    leads_appointment_booked: leadList.filter((l: Record<string, unknown>) => l['status'] === 'appointment_set').length,
    leads_disqualified: leadList.filter((l: Record<string, unknown>) => l['status'] === 'invalid').length,
    leads_unworked_count: unworkedCount ?? 0,
    avg_response_time_minutes: null, // Computed when activity tracking is live
    by_source: bySource,
  }
}

export async function computeProjectsDaily(
  companyId: string,
  _date: Date,
): Promise<ProjectsDailyMetrics> {
  const client = getServiceClient()

  const { data: projects } = await client
    .from('projects')
    .select('id, current_phase, phase_entered_at, status')
    .eq('company_id', companyId)
    .eq('status', 'active')

  const projectList = projects ?? []
  const now = new Date()

  const byPhase: Record<string, number> = {}
  let stalledCount = 0
  let delayedCount = 0

  for (const p of projectList) {
    const proj = p as Record<string, unknown>
    const phase = String(proj['current_phase'] ?? '0')
    byPhase[phase] = (byPhase[phase] ?? 0) + 1

    if (Number(proj['current_phase']) === 5) delayedCount++

    const enteredAt = new Date(proj['phase_entered_at'] as string)
    const daysInPhase = (now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysInPhase > 7 && Number(proj['current_phase']) !== 5) stalledCount++
  }

  // Completed in last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { count: completed30d } = await client
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('updated_at', thirtyDaysAgo.toISOString())

  return {
    total_active: projectList.length,
    by_phase: byPhase,
    stalled_count: stalledCount,
    delayed_count: delayedCount,
    completed_30d: completed30d ?? 0,
    avg_throughput_days: null, // Computed from phase history
  }
}

export async function computeFinanceMonthly(
  companyId: string,
  date: Date,
): Promise<FinanceMonthlyMetrics> {
  const client = getServiceClient()
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  const now = new Date()

  // Revenue from paid invoices this month
  const { data: paidInvoices } = await client
    .from('invoices')
    .select('total_chf')
    .eq('company_id', companyId)
    .eq('status', 'paid')
    .gte('paid_at', monthStart.toISOString())
    .lte('paid_at', monthEnd.toISOString())

  const revenue = (paidInvoices ?? []).reduce(
    (sum: number, inv: Record<string, unknown>) => sum + Number(inv['total_chf'] ?? 0), 0
  )

  // Open receivables
  const { data: openInvoices } = await client
    .from('invoices')
    .select('total_chf, due_at, status')
    .eq('company_id', companyId)
    .in('status', ['sent', 'partially_paid'])

  const openList = openInvoices ?? []
  const openReceivables = openList.reduce(
    (sum: number, inv: Record<string, unknown>) => sum + Number(inv['total_chf'] ?? 0), 0
  )
  const overdue = openList.filter(
    (inv: Record<string, unknown>) => new Date(inv['due_at'] as string) < now
  )

  // Forecast buckets
  const d30 = new Date(now); d30.setDate(d30.getDate() + 30)
  const d60 = new Date(now); d60.setDate(d60.getDate() + 60)
  const d90 = new Date(now); d90.setDate(d90.getDate() + 90)

  const forecast = (days: Date) => openList
    .filter((inv: Record<string, unknown>) => new Date(inv['due_at'] as string) <= days)
    .reduce((sum: number, inv: Record<string, unknown>) => sum + Number(inv['total_chf'] ?? 0), 0)

  return {
    revenue_total_chf: revenue,
    open_receivables_chf: openReceivables,
    overdue_count: overdue.length,
    overdue_amount_chf: overdue.reduce(
      (sum: number, inv: Record<string, unknown>) => sum + Number(inv['total_chf'] ?? 0), 0
    ),
    payments_received_chf: revenue, // Same as paid invoices this month
    forecast_30d_chf: forecast(d30),
    forecast_60d_chf: forecast(d60),
    forecast_90d_chf: forecast(d90),
  }
}

export async function computeTenantDailySummary(
  companyId: string,
  date: Date,
): Promise<TenantDailySummaryMetrics> {
  const client = getServiceClient()

  // Get all setters and beraters
  const { data: teamMembers } = await client
    .from('team_members')
    .select('id, role_type')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const setters = (teamMembers ?? []).filter((m: Record<string, unknown>) => m['role_type'] === 'setter')
  // Aggregate setter metrics
  const setterAgg: SetterDailyMetrics = {
    calls_total: 0, calls_answered: 0, calls_missed: 0, calls_voicemail: 0,
    reach_rate: 0, avg_duration_sec: 0, total_duration_sec: 0,
    appointments_booked: 0, appointment_rate: 0, no_show_count: 0, no_show_rate: 0,
  }
  for (const setter of setters) {
    const m = await computeSetterDaily(companyId, (setter as Record<string, unknown>)['id'] as string, date)
    setterAgg.calls_total += m.calls_total
    setterAgg.calls_answered += m.calls_answered
    setterAgg.calls_missed += m.calls_missed
    setterAgg.calls_voicemail += m.calls_voicemail
    setterAgg.total_duration_sec += m.total_duration_sec
    setterAgg.appointments_booked += m.appointments_booked
  }
  if (setterAgg.calls_total > 0) {
    setterAgg.reach_rate = setterAgg.calls_answered / setterAgg.calls_total
  }
  if (setterAgg.calls_answered > 0) {
    setterAgg.avg_duration_sec = Math.round(setterAgg.total_duration_sec / setterAgg.calls_answered)
    setterAgg.appointment_rate = setterAgg.appointments_booked / setterAgg.calls_answered
  }

  const leads = await computeLeadsDaily(companyId, date)
  const projects = await computeProjectsDaily(companyId, date)
  const finance = await computeFinanceMonthly(companyId, date)

  return {
    setter: setterAgg,
    berater: {
      appointments_total: 0, appointments_done: 0, appointments_no_show: 0,
      offers_created: 0, offers_won: 0, closing_rate: 0, pipeline_value_chf: 0,
      avg_deal_duration_days: null, activities_total: 0,
    },
    leads,
    projects,
    finance,
  }
}
