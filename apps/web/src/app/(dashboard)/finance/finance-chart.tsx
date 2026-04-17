'use client'

import { useState, useMemo } from 'react'

interface ChartEvent {
  date: string
  amount: number
  direction: string
}

interface Props {
  events: ChartEvent[]
  currency: string
}

type TimeRange = '3m' | '6m' | '12m' | 'all'
type Granularity = 'weekly' | 'monthly'

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function periodKey(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr)
  if (granularity === 'weekly') {
    // Use YYYY-Www for correct chronological sorting
    const week = getISOWeek(d)
    // ISO week year: if the week belongs to the previous/next year, adjust
    const jan4 = new Date(Date.UTC(d.getFullYear(), 0, 4))
    const isoYear = d.getMonth() === 0 && week > 50
      ? d.getFullYear() - 1
      : d.getMonth() === 11 && week === 1
        ? d.getFullYear() + 1
        : d.getFullYear()
    return `${isoYear}-W${String(week).padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function periodLabel(key: string, granularity: Granularity): string {
  if (granularity === 'weekly') {
    // key = "2026-W14" → "KW 14"
    const week = key.split('-W')[1]
    return `KW ${Number(week)}`
  }
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('de-CH', { month: 'short', year: '2-digit' })
}

export function FinanceCashflowChart({ events, currency }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const [granularity, setGranularity] = useState<Granularity>('weekly')

  const now = new Date()

  // Filter events by time range
  const filteredEvents = useMemo(() => {
    if (timeRange === 'all') return events
    const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12
    const cutoff = new Date(now)
    cutoff.setMonth(cutoff.getMonth() - months)
    return events.filter(e => new Date(e.date) >= cutoff)
  }, [events, timeRange])

  // Group by period (weekly or monthly)
  const periodData = useMemo(() => {
    const periods = new Map<string, { income: number; expense: number; cumulative: number }>()

    const sorted = [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date))

    for (const evt of sorted) {
      const key = periodKey(evt.date, granularity)
      const entry = periods.get(key) ?? { income: 0, expense: 0, cumulative: 0 }
      if (evt.direction === 'income') {
        entry.income += evt.amount
      } else {
        entry.expense += evt.amount
      }
      periods.set(key, entry)
    }

    // Calculate cumulative
    let cum = 0
    const result: Array<{ period: string; label: string; income: number; expense: number; cumulative: number }> = []
    for (const [key, data] of [...periods.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      cum += data.income - data.expense
      result.push({ period: key, label: periodLabel(key, granularity), income: data.income, expense: data.expense, cumulative: cum })
    }
    return result
  }, [filteredEvents, granularity])

  if (periodData.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">Keine Daten im gewählten Zeitraum.</p>
  }

  // Chart dimensions
  const maxValue = Math.max(...periodData.map(d => Math.max(d.income, d.expense, Math.abs(d.cumulative))))
  const chartH = 280
  const barAreaH = chartH - 40
  const scale = maxValue > 0 ? barAreaH / maxValue : 1
  const isWeekly = granularity === 'weekly'
  const colMinWidth = isWeekly ? 50 : 70

  function fmtCHF(n: number): string {
    return `${currency} ${n.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* Time slicer */}
        <div className="flex items-center gap-2">
          {([['3m', '3 Monate'], ['6m', '6 Monate'], ['12m', '12 Monate'], ['all', 'Alle']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTimeRange(key as TimeRange)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Granularity toggle */}
        <div className="flex items-center gap-2">
          {([['weekly', 'Wöchentlich'], ['monthly', 'Monatlich']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setGranularity(key as Granularity)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1" style={{ minWidth: periodData.length * colMinWidth, height: chartH }}>
          {periodData.map((d) => {
            const incomeH = d.income * scale * 0.45
            const expenseH = d.expense * scale * 0.45
            const cumH = Math.abs(d.cumulative) * scale * 0.45
            const cumPositive = d.cumulative >= 0

            return (
              <div key={d.period} className="flex-1 flex flex-col items-center gap-0.5" style={{ minWidth: colMinWidth }}>
                {/* Bars */}
                <div className="flex items-end gap-0.5 h-[240px]">
                  <div className="w-5 flex flex-col justify-end h-full">
                    <div
                      className="bg-green-500 rounded-t-sm w-full transition-all"
                      style={{ height: Math.max(incomeH, 1) }}
                      title={`Einnahmen: ${fmtCHF(d.income)}`}
                    />
                  </div>
                  <div className="w-5 flex flex-col justify-end h-full">
                    <div
                      className="bg-red-400 rounded-t-sm w-full transition-all"
                      style={{ height: Math.max(expenseH, 1) }}
                      title={`Ausgaben: ${fmtCHF(d.expense)}`}
                    />
                  </div>
                  <div className="w-5 flex flex-col justify-end h-full">
                    <div
                      className={`rounded-t-sm w-full transition-all ${cumPositive ? 'bg-blue-500' : 'bg-orange-500'}`}
                      style={{ height: Math.max(cumH, 1) }}
                      title={`Kumulativ: ${fmtCHF(d.cumulative)}`}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 mt-1">{d.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-green-500" /> Einnahmen
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-red-400" /> Ausgaben
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-blue-500" /> Kum. Cashflow (positiv)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-orange-500" /> Kum. Cashflow (negativ)
        </div>
      </div>

      {/* Totals table */}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-1.5 text-left text-gray-500 font-medium">{isWeekly ? 'Woche' : 'Monat'}</th>
              <th className="py-1.5 text-right text-green-600 font-medium">Einnahmen</th>
              <th className="py-1.5 text-right text-red-500 font-medium">Ausgaben</th>
              <th className="py-1.5 text-right text-gray-700 font-medium">Netto</th>
              <th className="py-1.5 text-right text-blue-600 font-medium">Kumulativ</th>
            </tr>
          </thead>
          <tbody>
            {periodData.map((d) => (
              <tr key={d.period} className="border-b border-gray-50">
                <td className="py-1.5 text-gray-700">{d.label}</td>
                <td className="py-1.5 text-right font-mono text-green-700">{fmtCHF(d.income)}</td>
                <td className="py-1.5 text-right font-mono text-red-600">{fmtCHF(d.expense)}</td>
                <td className={`py-1.5 text-right font-mono font-medium ${d.income - d.expense >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmtCHF(d.income - d.expense)}
                </td>
                <td className={`py-1.5 text-right font-mono font-medium ${d.cumulative >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                  {fmtCHF(d.cumulative)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
