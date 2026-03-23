export const KPI_SNAPSHOT_TYPES = {
  SETTER_DAILY: 'setter_daily',
  SETTER_WEEKLY: 'setter_weekly',
  BERATER_DAILY: 'berater_daily',
  BERATER_WEEKLY: 'berater_weekly',
  LEADS_DAILY: 'leads_daily',
  FINANCE_MONTHLY: 'finance_monthly',
  PROJECTS_DAILY: 'projects_daily',
  TENANT_DAILY_SUMMARY: 'tenant_daily_summary',
} as const

export type KpiSnapshotType = (typeof KPI_SNAPSHOT_TYPES)[keyof typeof KPI_SNAPSHOT_TYPES]

export type SetterDailyMetrics = {
  calls_total: number
  calls_answered: number
  calls_missed: number
  calls_voicemail: number
  reach_rate: number
  avg_duration_sec: number
  total_duration_sec: number
  appointments_booked: number
  appointment_rate: number
  no_show_count: number
  no_show_rate: number
}

export type BeraterDailyMetrics = {
  appointments_total: number
  appointments_done: number
  appointments_no_show: number
  offers_created: number
  offers_won: number
  closing_rate: number
  pipeline_value_chf: number
  avg_deal_duration_days: number | null
  activities_total: number
}

export type LeadsDailyMetrics = {
  leads_new: number
  leads_qualified: number
  leads_appointment_booked: number
  leads_disqualified: number
  leads_unworked_count: number
  avg_response_time_minutes: number | null
  by_source: Record<string, number>
}

export type FinanceMonthlyMetrics = {
  revenue_total_chf: number
  open_receivables_chf: number
  overdue_count: number
  overdue_amount_chf: number
  payments_received_chf: number
  forecast_30d_chf: number
  forecast_60d_chf: number
  forecast_90d_chf: number
}

export type ProjectsDailyMetrics = {
  total_active: number
  by_phase: Record<string, number>
  stalled_count: number
  delayed_count: number
  completed_30d: number
  avg_throughput_days: number | null
}

export type TenantDailySummaryMetrics = {
  setter: SetterDailyMetrics
  berater: BeraterDailyMetrics
  leads: LeadsDailyMetrics
  projects: ProjectsDailyMetrics
  finance: Partial<FinanceMonthlyMetrics>
}
