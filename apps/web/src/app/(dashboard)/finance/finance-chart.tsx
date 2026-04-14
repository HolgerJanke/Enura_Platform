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

export function FinanceCashflowChart({ events, currency }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')

  const now = new Date()

  // Filter events by time range
  const filteredEvents = useMemo(() => {
    if (timeRange === 'all') return events
    const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12
    const cutoff = new Date(now)
    cutoff.setMonth(cutoff.getMonth() - months)
    return events.filter(e => new Date(e.date) >= cutoff)
  }, [events, timeRange])

  // Group by month
  const monthlyData = useMemo(() => {
    const months = new Map<string, { income: number; expense: number; cumulative: number }>()

    // Sort all events
    const sorted = [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date))

    for (const evt of sorted) {
      const d = new Date(evt.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = months.get(key) ?? { income: 0, expense: 0, cumulative: 0 }
      if (evt.direction === 'income') {
        entry.income += evt.amount
      } else {
        entry.expense += evt.amount
      }
      months.set(key, entry)
    }

    // Calculate cumulative
    let cum = 0
    const result: Array<{ month: string; label: string; income: number; expense: number; cumulative: number }> = []
    for (const [key, data] of [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      cum += data.income - data.expense
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('de-CH', { month: 'short', year: '2-digit' })
      result.push({ month: key, label, income: data.income, expense: data.expense, cumulative: cum })
    }
    return result
  }, [filteredEvents])

  if (monthlyData.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">Keine Daten im gewählten Zeitraum.</p>
  }

  // Chart dimensions
  const maxValue = Math.max(...monthlyData.map(d => Math.max(d.income, d.expense, Math.abs(d.cumulative))))
  const chartH = 280
  const barAreaH = chartH - 40 // Leave space for labels
  const scale = maxValue > 0 ? barAreaH / maxValue : 1

  function fmtCHF(n: number): string {
    return `${currency} ${n.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`
  }

  return (
    <div>
      {/* Time slicer */}
      <div className="flex items-center gap-2 mb-4">
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

      {/* Bar chart */}
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1" style={{ minWidth: monthlyData.length * 80, height: chartH }}>
          {monthlyData.map((d) => {
            const incomeH = d.income * scale * 0.45
            const expenseH = d.expense * scale * 0.45
            const cumH = Math.abs(d.cumulative) * scale * 0.45
            const cumPositive = d.cumulative >= 0

            return (
              <div key={d.month} className="flex-1 min-w-[70px] flex flex-col items-center gap-0.5">
                {/* Bars */}
                <div className="flex items-end gap-0.5 h-[240px]">
                  {/* Income bar */}
                  <div className="w-5 flex flex-col justify-end h-full">
                    <div
                      className="bg-green-500 rounded-t-sm w-full transition-all"
                      style={{ height: Math.max(incomeH, 1) }}
                      title={`Einnahmen: ${fmtCHF(d.income)}`}
                    />
                  </div>
                  {/* Expense bar */}
                  <div className="w-5 flex flex-col justify-end h-full">
                    <div
                      className="bg-red-400 rounded-t-sm w-full transition-all"
                      style={{ height: Math.max(expenseH, 1) }}
                      title={`Ausgaben: ${fmtCHF(d.expense)}`}
                    />
                  </div>
                  {/* Cumulative bar */}
                  <div className="w-5 flex flex-col justify-end h-full">
                    <div
                      className={`rounded-t-sm w-full transition-all ${cumPositive ? 'bg-blue-500' : 'bg-orange-500'}`}
                      style={{ height: Math.max(cumH, 1) }}
                      title={`Kumulativ: ${fmtCHF(d.cumulative)}`}
                    />
                  </div>
                </div>
                {/* Month label */}
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

      {/* Monthly totals table */}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-1.5 text-left text-gray-500 font-medium">Monat</th>
              <th className="py-1.5 text-right text-green-600 font-medium">Einnahmen</th>
              <th className="py-1.5 text-right text-red-500 font-medium">Ausgaben</th>
              <th className="py-1.5 text-right text-gray-700 font-medium">Netto</th>
              <th className="py-1.5 text-right text-blue-600 font-medium">Kumulativ</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((d) => (
              <tr key={d.month} className="border-b border-gray-50">
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
