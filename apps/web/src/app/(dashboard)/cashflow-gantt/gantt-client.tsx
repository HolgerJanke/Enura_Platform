'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string
  title: string
  customer_name: string
  address_city: string | null
  project_value: number | null
  status: string
}

interface LiqEvent {
  id: string
  project_id: string
  step_name: string
  direction: string
  budget_amount: number | null
  budget_date: string | null
  scheduled_amount: number | null
  scheduled_date: string | null
  actual_amount: number | null
  actual_date: string | null
  marker_type: string
  invoice_id: string | null
}

interface Props {
  projects: Project[]
  events: LiqEvent[]
  currency: string
}

type ViewMode = 'progress' | 'cashflow'
type TimeRange = '3m' | '6m' | '12m' | 'all' | 'custom'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayDate(e: LiqEvent): string | null {
  return e.actual_date ?? e.scheduled_date ?? e.budget_date
}

function displayAmount(e: LiqEvent): number {
  return Number(e.actual_amount ?? e.scheduled_amount ?? e.budget_amount ?? 0)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatCHF(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`
}

// Income colors (blues), Expense colors (greens/teals)
const INCOME_COLORS = ['#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
const EXPENSE_COLORS = ['#065f46', '#047857', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GanttClient({ projects, events, currency }: Props) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('progress')
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [hoveredEvent, setHoveredEvent] = useState<LiqEvent | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Group events by project
  const eventsByProject = new Map<string, LiqEvent[]>()
  for (const e of events) {
    const arr = eventsByProject.get(e.project_id) ?? []
    arr.push(e)
    eventsByProject.set(e.project_id, arr)
  }

  // Calculate time range from slicer
  const allDates = events.map(e => displayDate(e)).filter(Boolean).map(d => new Date(d!))
  if (allDates.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-12">Keine Zahlungsereignisse vorhanden.</p>
  }

  const now = new Date()
  let minDate: Date
  let maxDate: Date

  if (timeRange === 'custom' && customFrom && customTo) {
    minDate = new Date(customFrom)
    maxDate = new Date(customTo)
  } else if (timeRange === 'all') {
    minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
    minDate.setDate(minDate.getDate() - 14)
    maxDate.setDate(maxDate.getDate() + 14)
  } else {
    const months = timeRange === '3m' ? 3 : timeRange === '12m' ? 12 : 6
    minDate = new Date(now)
    minDate.setMonth(minDate.getMonth() - 1)
    maxDate = new Date(now)
    maxDate.setMonth(maxDate.getMonth() + months - 1)
  }
  const totalDays = daysBetween(minDate, maxDate)
  const dayWidth = 4 // pixels per day
  const chartWidth = totalDays * dayWidth

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOffset = daysBetween(minDate, today) * dayWidth

  // Generate month labels
  const monthLabels: Array<{ label: string; x: number }> = []
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (cursor <= maxDate) {
    const x = daysBetween(minDate, cursor) * dayWidth
    monthLabels.push({
      label: cursor.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' }),
      x: Math.max(x, 0),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const ROW_H = 28
  const HEADER_H = 32
  const chartHeight = HEADER_H + projects.length * ROW_H + 20

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        {/* View switch */}
        <div className="flex items-center gap-2">
          {(['progress', 'cashflow'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mode === 'progress' ? 'Fortschritt' : 'Cashflow'}
            </button>
          ))}
        </div>

        {/* Time range slicer */}
        <div className="flex items-center gap-2">
          {([['3m', '3 Monate'], ['6m', '6 Monate'], ['12m', '12 Monate'], ['all', 'Alle']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTimeRange(key as TimeRange)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTimeRange('custom')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              timeRange === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Zeitraum
          </button>
          {timeRange === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Gantt chart */}
      <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden max-h-[70vh]">
        {/* Fixed left column — project names */}
        <div className="shrink-0 border-r border-gray-200 bg-gray-50 w-48 overflow-y-auto">
          <div className="h-8 border-b border-gray-200 px-3 flex items-center sticky top-0 bg-gray-50 z-20">
            <span className="text-[10px] font-medium text-gray-500 uppercase">Projekt</span>
          </div>
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="h-7 px-3 flex items-center border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => router.push(`/projects/${proj.id}`)}
            >
              <span className="text-[11px] text-gray-900 truncate">{proj.customer_name}</span>
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div className="flex-1 overflow-auto">
          <div style={{ width: chartWidth, minWidth: '100%' }} className="relative">
            {/* Month headers — sticky */}
            <div className="h-8 border-b border-gray-200 relative sticky top-0 bg-white z-20">
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="absolute text-[10px] text-gray-400 font-medium top-2"
                  style={{ left: m.x + 4 }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Today line */}
            {todayOffset > 0 && todayOffset < chartWidth && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                style={{ left: todayOffset }}
              >
                <span className="absolute -top-0 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded">Heute</span>
              </div>
            )}

            {/* Project rows */}
            {projects.map((proj, rowIdx) => {
              const projEvents = eventsByProject.get(proj.id) ?? []

              if (viewMode === 'cashflow') {
                // Cashflow view: horizontal bar showing cumulative
                let cumulative = 0
                const segments: Array<{ x: number; w: number; positive: boolean }> = []
                const sorted = [...projEvents].sort((a, b) => {
                  const da = displayDate(a) ?? '9999'
                  const db = displayDate(b) ?? '9999'
                  return da.localeCompare(db)
                })

                let prevX = 0
                for (const evt of sorted) {
                  const d = displayDate(evt)
                  if (!d) continue
                  const x = daysBetween(minDate, new Date(d)) * dayWidth
                  const amt = displayAmount(evt)
                  const signed = evt.direction === 'income' ? amt : -amt

                  if (prevX < x && segments.length > 0) {
                    segments[segments.length - 1]!.w = x - segments[segments.length - 1]!.x
                  }

                  cumulative += signed
                  segments.push({ x, w: 8, positive: cumulative >= 0 })
                  prevX = x
                }
                // Extend last segment
                if (segments.length > 0) {
                  const last = segments[segments.length - 1]!
                  last.w = Math.max(last.w, 20)
                }

                return (
                  <div key={proj.id} className="h-7 border-b border-gray-50 relative">
                    {segments.map((seg, si) => (
                      <div
                        key={si}
                        className={`absolute top-1 h-5 rounded-sm ${seg.positive ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ left: seg.x, width: Math.max(seg.w, 2) }}
                      />
                    ))}
                  </div>
                )
              }

              // Progress view: individual event blocks
              return (
                <div key={proj.id} className="h-7 border-b border-gray-50 relative">
                  {projEvents.map((evt, evtIdx) => {
                    const d = displayDate(evt)
                    if (!d) return null
                    const x = daysBetween(minDate, new Date(d)) * dayWidth
                    const isIncome = evt.direction === 'income'
                    const hasActual = evt.actual_date != null
                    const colors = isIncome ? INCOME_COLORS : EXPENSE_COLORS
                    const colorIdx = Math.min(evtIdx, colors.length - 1)
                    const bg = colors[colorIdx]

                    return (
                      <div
                        key={evt.id}
                        className="absolute top-1 flex items-center justify-center rounded-sm cursor-pointer transition-transform hover:scale-110 hover:z-20"
                        style={{
                          left: x - 10,
                          width: 20,
                          height: 20,
                          background: hasActual ? bg : 'transparent',
                          border: hasActual ? 'none' : `2px solid ${bg}`,
                          color: hasActual ? 'white' : bg,
                        }}
                        onMouseEnter={(e) => {
                          setHoveredEvent(evt)
                          setTooltipPos({ x: e.clientX, y: e.clientY })
                        }}
                        onMouseLeave={() => setHoveredEvent(null)}
                        onClick={() => {
                          if (evt.invoice_id) {
                            router.push(`/finanzplanung/eingang/${evt.invoice_id}`)
                          } else {
                            router.push(`/projects/${proj.id}`)
                          }
                        }}
                      >
                        <span className="text-[8px] font-bold">{evtIdx + 1}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredEvent && (
        <div
          className="fixed z-50 bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40 }}
        >
          <p className="font-semibold">{hoveredEvent.step_name}</p>
          <p className="text-gray-300 mt-0.5">
            {hoveredEvent.direction === 'income' ? 'Einnahme' : 'Ausgabe'}: {formatCHF(displayAmount(hoveredEvent), currency)}
          </p>
          <p className="text-gray-400 mt-0.5">
            {hoveredEvent.actual_date
              ? `Ist: ${new Date(hoveredEvent.actual_date).toLocaleDateString('de-CH')}`
              : hoveredEvent.scheduled_date
                ? `Plan: ${new Date(hoveredEvent.scheduled_date).toLocaleDateString('de-CH')}`
                : hoveredEvent.budget_date
                  ? `Budget: ${new Date(hoveredEvent.budget_date).toLocaleDateString('de-CH')}`
                  : '—'
            }
          </p>
          {hoveredEvent.actual_date ? (
            <span className="inline-block mt-1 rounded bg-green-600 px-1.5 py-0.5 text-[9px]">Realisiert</span>
          ) : (
            <span className="inline-block mt-1 rounded bg-gray-600 px-1.5 py-0.5 text-[9px]">Geplant</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-blue-600" /> Einnahme (realisiert)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm border-2 border-blue-600" /> Einnahme (geplant)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-emerald-600" /> Ausgabe (realisiert)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm border-2 border-emerald-600" /> Ausgabe (geplant)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-px bg-red-400" /> Heute
        </div>
      </div>
    </div>
  )
}
