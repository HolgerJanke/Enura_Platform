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
type TimeRange = '1m' | '3m' | '6m' | '12m' | 'all' | 'custom'

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
  const defaultFrom = new Date(); defaultFrom.setMonth(defaultFrom.getMonth() - 3)
  const defaultTo = new Date(); defaultTo.setMonth(defaultTo.getMonth() + 6)
  const [customFrom, setCustomFrom] = useState(defaultFrom.toISOString().split('T')[0]!)
  const [customTo, setCustomTo] = useState(defaultTo.toISOString().split('T')[0]!)
  const [projectFilter, setProjectFilter] = useState('')
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
  } else if (timeRange === '1m') {
    // Current month: 1st of this month to end of next month
    minDate = new Date(now.getFullYear(), now.getMonth(), 1)
    maxDate = new Date(now.getFullYear(), now.getMonth() + 2, 0)
  } else if (timeRange === '3m') {
    // Last 1 month + next 3 months
    minDate = new Date(now)
    minDate.setMonth(minDate.getMonth() - 1)
    maxDate = new Date(now)
    maxDate.setMonth(maxDate.getMonth() + 3)
  } else if (timeRange === '6m') {
    // Last 1 month + next 6 months
    minDate = new Date(now)
    minDate.setMonth(minDate.getMonth() - 1)
    maxDate = new Date(now)
    maxDate.setMonth(maxDate.getMonth() + 6)
  } else {
    // 12m: Last 2 months + next 12 months
    minDate = new Date(now)
    minDate.setMonth(minDate.getMonth() - 2)
    maxDate = new Date(now)
    maxDate.setMonth(maxDate.getMonth() + 12)
  }
  const totalDays = Math.max(daysBetween(minDate, maxDate), 1)
  // Fill screen width: chart should always span the available area
  // Use CSS 100% for the container, calculate dayWidth to fill ~900px
  const targetWidth = 900
  const dayWidth = Math.max(Math.round(targetWidth / totalDays), 2)
  const chartWidth = Math.max(totalDays * dayWidth, targetWidth)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOffset = daysBetween(minDate, today) * dayWidth

  // Generate time labels based on granularity
  type TimeLabel = { label: string; x: number; minor?: boolean }
  const timeLabels: TimeLabel[] = []

  if (totalDays <= 30) {
    // Daily labels
    const dayCursor = new Date(minDate)
    while (dayCursor <= maxDate) {
      const x = daysBetween(minDate, dayCursor) * dayWidth
      const isMonday = dayCursor.getDay() === 1
      timeLabels.push({
        label: dayCursor.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }),
        x: Math.max(x, 0),
        minor: !isMonday,
      })
      dayCursor.setDate(dayCursor.getDate() + 1)
    }
  } else if (totalDays <= 90) {
    // Weekly labels
    const weekCursor = new Date(minDate)
    // Align to Monday
    const dow = weekCursor.getDay()
    weekCursor.setDate(weekCursor.getDate() - (dow === 0 ? 6 : dow - 1))
    while (weekCursor <= maxDate) {
      const x = daysBetween(minDate, weekCursor) * dayWidth
      if (x >= 0) {
        timeLabels.push({
          label: weekCursor.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }),
          x,
        })
      }
      weekCursor.setDate(weekCursor.getDate() + 7)
    }
  } else {
    // Monthly labels
    const monthCursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (monthCursor <= maxDate) {
      const x = daysBetween(minDate, monthCursor) * dayWidth
      timeLabels.push({
        label: monthCursor.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' }),
        x: Math.max(x, 0),
      })
      monthCursor.setMonth(monthCursor.getMonth() + 1)
    }
  }

  const ROW_H = 28
  const HEADER_H = 32
  const chartHeight = HEADER_H + projects.length * ROW_H + 20

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        {/* View switch + project filter */}
        <div className="flex items-center gap-3">
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
          {/* Project filter */}
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Projekt filtern..."
              className="w-32 text-xs text-gray-900 placeholder-gray-400 outline-none bg-transparent"
            />
            {projectFilter && (
              <button type="button" onClick={() => setProjectFilter('')} className="text-gray-400 hover:text-gray-600 text-xs">×</button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          {viewMode === 'progress' ? (
            <>
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Einnahme (Ist)</div>
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm border-2 border-blue-600" /> Einnahme (Plan)</div>
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Ausgabe (Ist)</div>
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm border-2 border-emerald-600" /> Ausgabe (Plan)</div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1"><div className="h-2.5 w-4 rounded-sm bg-green-400" /> Cashflow positiv</div>
              <div className="flex items-center gap-1"><div className="h-2.5 w-4 rounded-sm bg-red-400" /> Cashflow negativ</div>
            </>
          )}
          <div className="flex items-center gap-1"><div className="h-3 w-px bg-red-500" /> Heute</div>
        </div>

        {/* Time range slicer */}
        <div className="flex items-center gap-2">
          {([['1m', '1 Monat'], ['3m', '3 Monate'], ['6m', '6 Monate'], ['12m', '12 Monate'], ['all', 'Alle']] as const).map(([key, label]) => (
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

      {/* Gantt chart — single scroll container */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-auto max-h-[70vh]">
        <div style={{ width: chartWidth + 192, minWidth: '100%' }} className="relative">
          {/* Header row */}
          <div className="flex sticky top-0 z-20">
            {/* Project column header */}
            <div className="shrink-0 w-48 h-8 border-b border-r border-gray-200 bg-gray-50 px-3 flex items-center sticky left-0 z-30">
              <span className="text-[10px] font-medium text-gray-500 uppercase">Projekt</span>
            </div>
            {/* Time headers */}
            <div className="h-8 border-b border-gray-200 relative bg-white flex-1">
              {timeLabels.map((t, i) => (
                <span
                  key={i}
                  className={`absolute text-[10px] top-2 ${t.minor ? 'text-gray-300' : 'text-gray-400 font-medium'}`}
                  style={{ left: t.x + 4 }}
                >
                  {t.minor ? '' : t.label}
                </span>
              ))}
              {/* Vertical grid lines */}
              {timeLabels.filter(t => !t.minor).map((t, i) => (
                <div key={`g${i}`} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: t.x }} />
              ))}
            </div>
          </div>

          {/* Today line */}
          {todayOffset > 0 && todayOffset < chartWidth && (
            <div
              className="absolute top-8 bottom-0 w-px bg-red-400 z-10"
              style={{ left: todayOffset + 192 }}
            >
              <span className="absolute -top-0 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded">Heute</span>
            </div>
          )}

          {/* Project rows */}
          {projects.filter(p => {
            // Text filter
            if (projectFilter && !p.customer_name.toLowerCase().includes(projectFilter.toLowerCase())
              && !p.title.toLowerCase().includes(projectFilter.toLowerCase())) return false
            // Show projects with ANY events (not filtered by visible range —
            // projects may span across ranges, cashflow accumulates from the start)
            const evts = eventsByProject.get(p.id) ?? []
            return evts.length > 0
          }).map((proj, rowIdx) => {
            const projEvents = eventsByProject.get(proj.id) ?? []

            // Sticky project name for this row
            const nameCell = (
              <div
                className="shrink-0 w-48 h-7 border-b border-r border-gray-100 bg-gray-50 px-3 flex items-center sticky left-0 z-10 cursor-pointer hover:bg-gray-100"
                onClick={() => router.push(`/projects/${proj.id}?ref=/cashflow-gantt`)}
              >
                <span className="text-[11px] text-gray-900 truncate">{proj.customer_name}</span>
              </div>
            )

            if (viewMode === 'cashflow') {
              // Cashflow view — identical logic to project card "Kum. Cashflow" column
              // Sort by displayDate (Ist > Plan > Budget), amount = displayAmount
              let cumulative = 0
              const sorted = [...projEvents]
                .filter(e => displayDate(e) != null)
                .sort((a, b) => (displayDate(a) ?? '').localeCompare(displayDate(b) ?? ''))

              // Step 1: Calculate cumulative cashflow at each event point
              const points: Array<{ x: number; positive: boolean }> = []
              let minCashflow = 0
              for (const evt of sorted) {
                const d = displayDate(evt)!
                const x = daysBetween(minDate, new Date(d)) * dayWidth
                const amt = displayAmount(evt)
                cumulative += evt.direction === 'income' ? amt : -amt
                points.push({ x, positive: cumulative >= 0 })
                if (cumulative < minCashflow) minCashflow = cumulative
              }

              // Step 2: Build non-overlapping segments between consecutive points
              const segments: Array<{ x: number; w: number; positive: boolean }> = []
              for (let pi = 0; pi < points.length; pi++) {
                const startX = points[pi]!.x
                const endX = pi < points.length - 1 ? points[pi + 1]!.x : startX + dayWidth * 7
                // Only render if segment overlaps visible area [0, chartWidth]
                const visStart = Math.max(startX, 0)
                const visEnd = Math.min(endX, chartWidth)
                if (visEnd > visStart) {
                  segments.push({ x: visStart, w: visEnd - visStart, positive: points[pi]!.positive })
                }
              }

              // Debug: log segments for projects with "Keller" in name
              if (proj.customer_name.includes('Keller')) {
                console.log(`[Gantt Debug] ${proj.customer_name}:`, {
                  eventsCount: sorted.length,
                  points: points.map((p, i) => ({
                    step: sorted[i]?.step_name,
                    dir: sorted[i]?.direction,
                    amt: displayAmount(sorted[i]!),
                    date: displayDate(sorted[i]!),
                    x: p.x,
                    positive: p.positive,
                  })),
                  segments: segments.map(s => ({ x: s.x, w: s.w, positive: s.positive })),
                  chartWidth,
                  dayWidth,
                  minDate: minDate.toISOString().split('T')[0],
                  maxDate: maxDate.toISOString().split('T')[0],
                })
              }

              // Position label after last segment
              const lastSeg = segments.length > 0 ? segments[segments.length - 1]! : null
              const labelX = lastSeg ? lastSeg.x + lastSeg.w + 4 : 0

              return (
                <div key={proj.id} className="flex">
                  {nameCell}
                  <div className="h-7 border-b border-gray-50 relative flex-1">
                    {segments.map((seg, si) => (
                      <div
                        key={si}
                        className={`absolute top-1 h-5 rounded-sm ${seg.positive ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ left: seg.x, width: Math.max(seg.w, 2) }}
                      />
                    ))}
                    {segments.length > 0 && minCashflow < 0 && (
                      <span
                        className="absolute top-0.5 text-[9px] font-medium text-red-600 whitespace-nowrap"
                        style={{ left: labelX }}
                      >
                        {formatCHF(minCashflow, currency)}
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            // Progress view: individual event blocks
            const blockSize = Math.max(Math.min(dayWidth, 16), 10)
            return (
              <div key={proj.id} className="flex">
                {nameCell}
                <div className="h-7 border-b border-gray-50 relative flex-1">
                  {projEvents.map((evt, evtIdx) => {
                    const d = displayDate(evt)
                    if (!d) return null
                    const evtDate = new Date(d)
                    if (evtDate < minDate || evtDate > maxDate) return null
                    const x = daysBetween(minDate, evtDate) * dayWidth
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
                          left: x,
                          width: blockSize,
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
                            router.push(`/projects/${proj.id}?ref=/cashflow-gantt`)
                          }
                        }}
                      >
                        <span className="text-[8px] font-bold">{evtIdx + 1}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
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

      {/* empty — legend moved to header */}
    </div>
  )
}
