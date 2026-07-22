import { z } from 'zod'

export const KPI_SNAPSHOT_TYPES = {
  SETTER_DAILY: 'setter_daily',
  SETTER_WEEKLY: 'setter_weekly',
  BERATER_DAILY: 'berater_daily',
  BERATER_WEEKLY: 'berater_weekly',
  LEADS_DAILY: 'leads_daily',
  FINANCE_DAILY: 'finance_daily',
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

// ---------------------------------------------------------------------------
// Snapshot metrics as written by the KPI cron (apps/web api/cron/kpi-snapshots)
// ---------------------------------------------------------------------------
// Dashboards read these instead of scanning raw tables on every render
// (CLAUDE.md §8). Parsed with Zod: snapshots written before a schema change
// simply fail to parse and the caller falls back to a live computation.

export const OffersSummaryMetricsSchema = z.object({
  total: z.number(),
  won: z.number(),
  lost: z.number(),
  open: z.number(),
  pipeline_value: z.number(),
  won_revenue: z.number(),
  win_rate: z.number(),
  by_status: z.record(z.number()),
  by_month: z.record(z.number()),
  won_revenue_by_month: z.record(z.number()),
})
export type OffersSummaryMetrics = z.infer<typeof OffersSummaryMetricsSchema>

export const LeadsSummaryMetricsSchema = z.object({
  total: z.number(),
  new_today: z.number(),
  by_status: z.record(z.number()),
  by_source: z.record(z.number()),
})
export type LeadsSummaryMetrics = z.infer<typeof LeadsSummaryMetricsSchema>

export const TopSellerSchema = z.object({
  id: z.string(),
  name: z.string(),
  won: z.number(),
})
export type TopSeller = z.infer<typeof TopSellerSchema>

export const TenantSummarySnapshotSchema = z
  .object({
    leads: LeadsSummaryMetricsSchema,
    offers: OffersSummaryMetricsSchema,
    top_sellers: z.array(TopSellerSchema).default([]),
  })
  .passthrough()
export type TenantSummarySnapshotMetrics = z.infer<typeof TenantSummarySnapshotSchema>

export const FinanceDailySnapshotSchema = z.object({
  bexio: z.object({
    invoice_count: z.number(),
    total_invoiced: z.number(),
    paid_count: z.number(),
    total_paid: z.number(),
    open_count: z.number(),
    total_open: z.number(),
    overdue_count: z.number(),
    total_overdue: z.number(),
    by_status: z.record(z.number()),
    payment_count: z.number(),
    total_payments: z.number(),
  }),
  incoming: z.object({
    count: z.number(),
    open_count: z.number(),
    open_amount: z.number(),
    overdue_count: z.number(),
    overdue_amount: z.number(),
  }),
  liquidity: z.object({
    event_count: z.number(),
    forecast_30: z.number(),
    forecast_60: z.number(),
    forecast_90: z.number(),
  }),
})
export type FinanceDailySnapshotMetrics = z.infer<typeof FinanceDailySnapshotSchema>

/** Null when the metrics blob is missing or predates the current schema. */
export function parseTenantSummaryMetrics(
  metrics: unknown,
): TenantSummarySnapshotMetrics | null {
  const result = TenantSummarySnapshotSchema.safeParse(metrics)
  return result.success ? result.data : null
}

/** Null when the metrics blob is missing or predates the current schema. */
export function parseFinanceDailyMetrics(
  metrics: unknown,
): FinanceDailySnapshotMetrics | null {
  const result = FinanceDailySnapshotSchema.safeParse(metrics)
  return result.success ? result.data : null
}
