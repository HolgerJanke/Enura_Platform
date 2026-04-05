// =============================================================================
// Liquidity Aggregator — Fetches and groups liquidity_event_instances
// into weekly or monthly periods with plan vs actual computation.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { LiquidityEventInstanceRow } from '@enura/types'

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type GroupBy = 'weekly' | 'monthly'

export interface LiquidityAggregationOptions {
  companyId: string
  from: string            // ISO date string (YYYY-MM-DD)
  to: string              // ISO date string (YYYY-MM-DD)
  groupBy: GroupBy
  currency?: string       // default: 'CHF'
}

export interface LiquidityPeriod {
  periodKey: string       // e.g. '2026-W13' or '2026-03'
  periodLabel: string     // e.g. 'KW 13 (2026)' or 'Maerz 2026'
  from: string
  to: string
  planIncome: number
  planExpense: number
  planNet: number
  actualIncome: number
  actualExpense: number
  actualNet: number
  deviation: number
  cumulativePlan: number
  cumulativeActual: number
}

export interface OverdueEvent {
  id: string
  projectId: string
  projectTitle: string
  stepName: string
  direction: 'income' | 'expense'
  planDate: string
  planAmount: number
  planCurrency: string
  daysOverdue: number
}

export interface LiquidityAggregationResult {
  periods: LiquidityPeriod[]
  overdueEvents: OverdueEvent[]
  openingBalance: number
}

// ---------------------------------------------------------------------------
// Month names for German labels
// ---------------------------------------------------------------------------

const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(dateStr: string): Date {
  return new Date(dateStr)
}

function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getISOWeekYear(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  return date.getUTCFullYear()
}

function periodKeyForDate(d: Date, groupBy: GroupBy): string {
  if (groupBy === 'weekly') {
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    return `${year}-W${String(week).padStart(2, '0')}`
  }
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function periodLabelForKey(key: string, groupBy: GroupBy): string {
  if (groupBy === 'weekly') {
    const parts = key.split('-W')
    return `KW ${parts[1]} (${parts[0]})`
  }
  const [year, month] = key.split('-')
  const monthIdx = parseInt(month ?? '1', 10) - 1
  return `${MONTH_NAMES_DE[monthIdx]} ${year}`
}

function generatePeriodKeys(from: Date, to: Date, groupBy: GroupBy): string[] {
  const keys: string[] = []
  const current = new Date(from)
  const seen = new Set<string>()

  while (current <= to) {
    const key = periodKeyForDate(current, groupBy)
    if (!seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
    current.setDate(current.getDate() + (groupBy === 'weekly' ? 7 : 1))
  }

  // Ensure the final period is included
  const lastKey = periodKeyForDate(to, groupBy)
  if (!seen.has(lastKey)) {
    keys.push(lastKey)
  }

  return keys
}

function periodBounds(key: string, groupBy: GroupBy): { from: string; to: string } {
  if (groupBy === 'weekly') {
    const [yearStr, weekStr] = key.split('-W')
    const year = parseInt(yearStr ?? '2026', 10)
    const week = parseInt(weekStr ?? '1', 10)
    // ISO week 1 starts on the Monday closest to Jan 1
    const jan4 = new Date(Date.UTC(year, 0, 4))
    const dayOfWeek = jan4.getUTCDay() || 7
    const monday = new Date(jan4)
    monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7)
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)
    return {
      from: monday.toISOString().split('T')[0]!,
      to: sunday.toISOString().split('T')[0]!,
    }
  }
  const [yearStr, monthStr] = key.split('-')
  const year = parseInt(yearStr ?? '2026', 10)
  const month = parseInt(monthStr ?? '1', 10) - 1
  const firstDay = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return {
    from: firstDay.toISOString().split('T')[0]!,
    to: lastDay.toISOString().split('T')[0]!,
  }
}

// ---------------------------------------------------------------------------
// Main aggregation function
// ---------------------------------------------------------------------------

export async function aggregateLiquidity(
  supabase: SupabaseClient,
  options: LiquidityAggregationOptions,
): Promise<LiquidityAggregationResult> {
  const { companyId, from, to, groupBy, currency = 'CHF' } = options

  // Fetch all liquidity event instances in the date range (using budget_date)
  const { data: events, error } = await supabase
    .from('liquidity_event_instances')
    .select(`
      id, project_id, step_name, marker_type, direction,
      plan_currency, budget_amount, budget_date,
      actual_date, actual_currency, actual_amount, fx_rate,
      actual_source, amount_deviation, date_deviation_days,
      trigger_activated_at
    `)
    .eq('company_id', companyId)
    .eq('marker_type', 'event')
    .gte('budget_date', from)
    .lte('budget_date', to)
    .order('budget_date', { ascending: true })

  if (error) {
    throw new Error(`Fehler beim Laden der Liquiditaetsereignisse: ${error.message}`)
  }

  const rows = (events ?? []) as unknown as LiquidityEventInstanceRow[]

  // Fetch opening balance from company_settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('opening_balance')
    .eq('company_id', companyId)
    .maybeSingle()

  const openingBalance = settings
    ? Number((settings as Record<string, unknown>)['opening_balance'] ?? 0)
    : 0

  // Generate period structure
  const periodKeys = generatePeriodKeys(toDate(from), toDate(to), groupBy)

  const periodMap = new Map<string, {
    planIncome: number
    planExpense: number
    actualIncome: number
    actualExpense: number
  }>()

  for (const key of periodKeys) {
    periodMap.set(key, { planIncome: 0, planExpense: 0, actualIncome: 0, actualExpense: 0 })
  }

  // Distribute events into periods
  for (const row of rows) {
    if (!row.budget_date) continue

    // Currency filter: only include events in the target currency
    if (row.plan_currency !== currency) continue

    const planDate = toDate(row.budget_date)
    const key = periodKeyForDate(planDate, groupBy)
    const bucket = periodMap.get(key)
    if (!bucket) continue

    const planAmount = Number(row.budget_amount ?? 0)
    const actualAmount = Number(row.actual_amount ?? 0)

    if (row.direction === 'income') {
      bucket.planIncome += planAmount
      if (row.actual_date) {
        bucket.actualIncome += actualAmount
      }
    } else {
      bucket.planExpense += planAmount
      if (row.actual_date) {
        bucket.actualExpense += actualAmount
      }
    }
  }

  // Build periods array with cumulative totals
  let cumulativePlan = openingBalance
  let cumulativeActual = openingBalance

  const periods: LiquidityPeriod[] = periodKeys.map((key) => {
    const bucket = periodMap.get(key)!
    const planNet = bucket.planIncome - bucket.planExpense
    const actualNet = bucket.actualIncome - bucket.actualExpense
    cumulativePlan += planNet
    cumulativeActual += actualNet

    const bounds = periodBounds(key, groupBy)

    return {
      periodKey: key,
      periodLabel: periodLabelForKey(key, groupBy),
      from: bounds.from,
      to: bounds.to,
      planIncome: bucket.planIncome,
      planExpense: bucket.planExpense,
      planNet,
      actualIncome: bucket.actualIncome,
      actualExpense: bucket.actualExpense,
      actualNet,
      deviation: actualNet - planNet,
      cumulativePlan,
      cumulativeActual,
    }
  })

  // Fetch overdue events (budget_date in past, no actual_date)
  const today = new Date().toISOString().split('T')[0]!
  const { data: overdueRows, error: overdueErr } = await supabase
    .from('liquidity_event_instances')
    .select(`
      id, project_id, step_name, direction,
      budget_date, budget_amount, plan_currency
    `)
    .eq('company_id', companyId)
    .eq('marker_type', 'event')
    .lt('budget_date', today)
    .is('actual_date', null)
    .order('budget_date', { ascending: true })

  if (overdueErr) {
    throw new Error(`Fehler beim Laden der ueberfaelligen Ereignisse: ${overdueErr.message}`)
  }

  // Fetch project titles for overdue events
  const overdueData = (overdueRows ?? []) as unknown as LiquidityEventInstanceRow[]
  const projectIds = [...new Set(overdueData.map((r) => r.project_id))]

  let projectTitleMap = new Map<string, string>()
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title')
      .in('id', projectIds)

    if (projects) {
      for (const p of projects as Array<{ id: string; title: string }>) {
        projectTitleMap.set(p.id, p.title)
      }
    }
  }

  const todayDate = new Date()
  const overdueEvents: OverdueEvent[] = overdueData.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectTitle: projectTitleMap.get(row.project_id) ?? 'Unbekanntes Projekt',
    stepName: row.step_name,
    direction: row.direction,
    planDate: row.budget_date!,
    planAmount: Number(row.budget_amount ?? 0),
    planCurrency: row.plan_currency,
    daysOverdue: diffDays(toDate(row.budget_date!), todayDate),
  }))

  return {
    periods,
    overdueEvents,
    openingBalance,
  }
}
