'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCHF, formatDate } from '@enura/types'
import { ManualEntryDrawer } from './manual-entry-drawer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiquidityEvent {
  id: string
  project_id: string
  step_name: string
  process_step_id: string
  marker_type: string
  direction: string
  plan_currency: string
  plan_amount: string | null
  plan_date: string | null
  actual_date: string | null
  actual_currency: string | null
  actual_amount: string | null
  actual_source: string | null
  amount_deviation: string | null
  date_deviation_days: number | null
  trigger_activated_at: string | null
  notes: string | null
}

type PeriodDays = 30 | 90 | 180
type GroupBy = 'weekly' | 'monthly'

interface PeriodBucket {
  key: string
  label: string
  planIncome: number
  planExpense: number
  actualIncome: number
  actualExpense: number
  planNet: number
  actualNet: number
  cumulativePlan: number
  cumulativeActual: number
}

interface Props {
  companyId: string
  events: LiquidityEvent[]
  overdueEvents: LiquidityEvent[]
  projectMap: Record<string, string>
  openingBalance: number
  minThreshold: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function periodKey(dateStr: string, groupBy: GroupBy): string {
  const d = new Date(dateStr)
  if (groupBy === 'weekly') {
    return `KW ${getISOWeek(d)}`
  }
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

function daysDiff(a: string, b: string): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  )
}

function formatAmount(value: number, currency: string): string {
  if (currency === 'EUR') {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }
  return formatCHF(value)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiquidityClient({
  companyId,
  events,
  overdueEvents,
  projectMap,
  openingBalance,
  minThreshold,
}: Props) {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(90)
  const [groupBy, setGroupBy] = useState<GroupBy>('monthly')
  const [currency, setCurrency] = useState('CHF')
  const [drawerEvent, setDrawerEvent] = useState<LiquidityEvent | null>(null)

  // Filter events by period and currency
  const filteredEvents = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() + periodDays)
    const past = new Date(now)
    past.setDate(past.getDate() - periodDays)

    return events.filter((e) => {
      if (!e.plan_date) return false
      if (e.plan_currency !== currency) return false
      const d = new Date(e.plan_date)
      return d >= past && d <= cutoff
    })
  }, [events, periodDays, currency])

  // Group into periods
  const periods = useMemo<PeriodBucket[]>(() => {
    const bucketMap = new Map<string, PeriodBucket>()
    const orderedKeys: string[] = []

    for (const evt of filteredEvents) {
      if (!evt.plan_date) continue
      const key = periodKey(evt.plan_date, groupBy)

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          key,
          label: key,
          planIncome: 0,
          planExpense: 0,
          actualIncome: 0,
          actualExpense: 0,
          planNet: 0,
          actualNet: 0,
          cumulativePlan: 0,
          cumulativeActual: 0,
        })
        orderedKeys.push(key)
      }

      const bucket = bucketMap.get(key)!
      const planAmt = Number(evt.plan_amount ?? 0)
      const actualAmt = Number(evt.actual_amount ?? 0)

      if (evt.direction === 'income') {
        bucket.planIncome += planAmt
        if (evt.actual_date) bucket.actualIncome += actualAmt
      } else {
        bucket.planExpense += planAmt
        if (evt.actual_date) bucket.actualExpense += actualAmt
      }
    }

    // Compute net and cumulative
    let cumPlan = openingBalance
    let cumActual = openingBalance

    return orderedKeys.map((key) => {
      const b = bucketMap.get(key)!
      b.planNet = b.planIncome - b.planExpense
      b.actualNet = b.actualIncome - b.actualExpense
      cumPlan += b.planNet
      cumActual += b.actualNet
      b.cumulativePlan = cumPlan
      b.cumulativeActual = cumActual
      return b
    })
  }, [filteredEvents, groupBy, openingBalance])

  // KPI summaries
  const totalPlanCumulative = periods.length > 0 ? periods[periods.length - 1]!.cumulativePlan : openingBalance
  const totalActualCumulative = periods.length > 0 ? periods[periods.length - 1]!.cumulativeActual : openingBalance
  const totalDeviation = totalActualCumulative - totalPlanCumulative

  // All events (for the table) — combine plan and overdue
  const allTableEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const da = a.plan_date ?? ''
      const db = b.plan_date ?? ''
      return da.localeCompare(db)
    })
  }, [filteredEvents])

  const handleCaptureActual = useCallback((evt: LiquidityEvent) => {
    setDrawerEvent(evt)
  }, [])

  return (
    <>
      {/* Filter controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-brand-text-secondary">Zeitraum:</label>
          <select
            className="rounded-brand border border-gray-200 bg-brand-surface px-3 py-1.5 text-sm text-brand-text-primary"
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value) as PeriodDays)}
          >
            <option value={30}>30 Tage</option>
            <option value={90}>90 Tage</option>
            <option value={180}>180 Tage</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-brand-text-secondary">Gruppierung:</label>
          <select
            className="rounded-brand border border-gray-200 bg-brand-surface px-3 py-1.5 text-sm text-brand-text-primary"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="weekly">Woechentlich</option>
            <option value="monthly">Monatlich</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-brand-text-secondary">Waehrung:</label>
          <select
            className="rounded-brand border border-gray-200 bg-brand-surface px-3 py-1.5 text-sm text-brand-text-primary"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Plan kumuliert</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatAmount(totalPlanCumulative, currency)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Ist kumuliert</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatAmount(totalActualCumulative, currency)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Abweichung</p>
          <p
            className={`text-2xl font-semibold mt-1 ${
              totalDeviation >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {totalDeviation >= 0 ? '+' : ''}
            {formatAmount(totalDeviation, currency)}
          </p>
        </div>
      </div>

      {/* Cashflow chart */}
      <div className="bg-brand-surface rounded-brand p-4 sm:p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-medium text-brand-text-primary mb-4">
          Cashflow-Verlauf
        </h2>
        {periods.length === 0 ? (
          <p className="text-sm text-brand-text-secondary py-8 text-center">
            Keine Liquiditaetsereignisse im gewaehlten Zeitraum.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={periods} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
                tickFormatter={(v: number) =>
                  `${v >= 0 ? '' : '-'}${Math.abs(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatAmount(value, currency),
                  name,
                ]}
                contentStyle={{
                  backgroundColor: 'var(--brand-surface)',
                  borderColor: '#e5e7eb',
                  borderRadius: 'var(--brand-radius)',
                }}
              />
              <Legend />
              {minThreshold > 0 && (
                <ReferenceLine
                  y={minThreshold}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  label={{ value: 'Schwelle', position: 'right', fill: '#ef4444', fontSize: 11 }}
                />
              )}
              <Bar
                dataKey="planIncome"
                name="Einnahmen (Plan)"
                stackId="plan"
                fill="var(--brand-primary)"
                fillOpacity={0.3}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="planExpense"
                name="Ausgaben (Plan)"
                stackId="plan"
                fill="#f59e0b"
                fillOpacity={0.3}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="actualIncome"
                name="Einnahmen (Ist)"
                stackId="actual"
                fill="var(--brand-primary)"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="actualExpense"
                name="Ausgaben (Ist)"
                stackId="actual"
                fill="#f59e0b"
                radius={[2, 2, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="cumulativePlan"
                name="Kumuliert (Plan)"
                stroke="var(--brand-primary)"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cumulativeActual"
                name="Kumuliert (Ist)"
                stroke="var(--brand-accent)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Overdue events section */}
      {overdueEvents.length > 0 && (
        <div className="rounded-brand border-2 border-red-300 bg-red-50 p-4 sm:p-6 mb-8">
          <h2 className="text-lg font-medium text-red-800 mb-4">
            Ueberfaellige Ereignisse ({overdueEvents.length})
          </h2>
          <div className="space-y-3">
            {overdueEvents.map((evt) => {
              const daysOver = evt.plan_date
                ? daysDiff(evt.plan_date, new Date().toISOString().split('T')[0]!)
                : 0
              return (
                <div
                  key={evt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-brand p-3 border border-red-200"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-brand-text-primary">
                      {projectMap[evt.project_id] ?? 'Projekt'} &mdash; {evt.step_name}
                    </p>
                    <p className="text-xs text-brand-text-secondary">
                      {evt.direction === 'income' ? 'Einnahme' : 'Ausgabe'} &middot;{' '}
                      Plan: {evt.plan_date ? formatDate(evt.plan_date) : '–'} &middot;{' '}
                      {formatAmount(Number(evt.plan_amount ?? 0), evt.plan_currency)} &middot;{' '}
                      <span className="text-red-600 font-medium">{daysOver} Tage ueberfaellig</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCaptureActual(evt)}
                    className="inline-flex items-center gap-1.5 rounded-brand bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                    aria-label={`Ist-Wert erfassen fuer ${evt.step_name}`}
                  >
                    Ist-Wert erfassen
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Plan vs Ist table */}
      <div className="bg-brand-surface rounded-brand border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary">
            Plan vs. Ist — Detailuebersicht
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-brand-text-secondary">Projekt</th>
                <th className="px-4 py-3 text-left font-medium text-brand-text-secondary">Schritt</th>
                <th className="px-4 py-3 text-left font-medium text-brand-text-secondary">Richtung</th>
                <th className="px-4 py-3 text-right font-medium text-brand-text-secondary">Plan-Datum</th>
                <th className="px-4 py-3 text-right font-medium text-brand-text-secondary">Plan-Betrag</th>
                <th className="px-4 py-3 text-right font-medium text-brand-text-secondary">Ist-Datum</th>
                <th className="px-4 py-3 text-right font-medium text-brand-text-secondary">Ist-Betrag</th>
                <th className="px-4 py-3 text-right font-medium text-brand-text-secondary">Abw. Datum</th>
                <th className="px-4 py-3 text-right font-medium text-brand-text-secondary">Abw. Betrag</th>
              </tr>
            </thead>
            <tbody>
              {allTableEvents.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-brand-text-secondary">
                    Keine Ereignisse im gewaehlten Zeitraum.
                  </td>
                </tr>
              )}
              {allTableEvents.map((evt) => {
                const planAmt = Number(evt.plan_amount ?? 0)
                const actualAmt = Number(evt.actual_amount ?? 0)
                const amtDev = evt.actual_date ? actualAmt - planAmt : null
                const dateDev = evt.date_deviation_days

                return (
                  <tr key={evt.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-brand-text-primary">
                      {projectMap[evt.project_id] ?? '–'}
                    </td>
                    <td className="px-4 py-3 text-brand-text-primary">{evt.step_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          evt.direction === 'income'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {evt.direction === 'income' ? 'Einnahme' : 'Ausgabe'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-brand-text-primary tabular-nums">
                      {evt.plan_date ? formatDate(evt.plan_date) : '–'}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-text-primary tabular-nums">
                      {formatAmount(planAmt, evt.plan_currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-text-primary tabular-nums">
                      {evt.actual_date ? formatDate(evt.actual_date) : '–'}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-text-primary tabular-nums">
                      {evt.actual_date
                        ? formatAmount(actualAmt, evt.actual_currency ?? evt.plan_currency)
                        : '–'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {dateDev !== null && dateDev !== undefined ? (
                        <span
                          className={
                            dateDev === 0
                              ? 'text-brand-text-secondary'
                              : dateDev > 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }
                        >
                          {dateDev > 0 ? `+${dateDev}` : dateDev} Tg.
                        </span>
                      ) : (
                        '–'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {amtDev !== null ? (
                        <span
                          className={
                            amtDev === 0
                              ? 'text-brand-text-secondary'
                              : amtDev > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {amtDev > 0 ? '+' : ''}
                          {formatAmount(amtDev, evt.plan_currency)}
                        </span>
                      ) : (
                        '–'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual entry drawer */}
      {drawerEvent && (
        <ManualEntryDrawer
          event={drawerEvent}
          companyId={companyId}
          projectName={projectMap[drawerEvent.project_id] ?? 'Projekt'}
          onClose={() => setDrawerEvent(null)}
        />
      )}
    </>
  )
}
