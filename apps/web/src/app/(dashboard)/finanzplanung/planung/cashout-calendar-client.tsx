'use client'

import { useState, useCallback } from 'react'
import { scheduleInvoicePayment } from '../actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceCard {
  id: string
  invoice_number: string | null
  sender_name: string | null
  gross_amount: number
  currency: string
  due_date: string
  scheduled_date: string | null
}

type ViewMode = 'daily' | 'weekly' | 'monthly'

interface Props {
  invoices: InvoiceCard[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
}

function formatCHF(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashoutCalendar({ invoices }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [localInvoices, setLocalInvoices] = useState(invoices)

  // Generate columns based on view mode
  const columns = generateColumns(baseDate, viewMode)

  // Group invoices by column date
  const grouped = new Map<string, InvoiceCard[]>()
  for (const col of columns) {
    grouped.set(col.key, [])
  }
  for (const inv of localInvoices) {
    const effectiveDate = inv.scheduled_date ?? inv.due_date
    const col = findColumn(effectiveDate, columns, viewMode)
    if (col) {
      const arr = grouped.get(col.key) ?? []
      arr.push(inv)
      grouped.set(col.key, arr)
    }
  }

  const handleDragStart = useCallback((invoiceId: string) => {
    setDraggedId(invoiceId)
  }, [])

  const handleDrop = useCallback(async (targetDate: string) => {
    if (!draggedId) return
    setDraggedId(null)

    // Update local state immediately
    setLocalInvoices(prev => prev.map(inv =>
      inv.id === draggedId ? { ...inv, scheduled_date: targetDate } : inv,
    ))

    // Persist to server
    await scheduleInvoicePayment(draggedId, targetDate)
  }, [draggedId])

  const navigate = useCallback((direction: -1 | 1) => {
    setBaseDate(prev => {
      const days = viewMode === 'daily' ? 7 : viewMode === 'weekly' ? 28 : 90
      return addDays(prev, direction * days)
    })
  }, [viewMode])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mode === 'daily' ? 'Täglich' : mode === 'weekly' ? 'Wöchentlich' : 'Monatlich'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            ← Zurück
          </button>
          <button
            type="button"
            onClick={() => setBaseDate(new Date())}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Heute
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Weiter →
          </button>
        </div>
      </div>

      {/* Calendar columns */}
      <div className="flex gap-2 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colInvoices = grouped.get(col.key) ?? []
          const colTotal = colInvoices.reduce((sum, inv) => sum + inv.gross_amount, 0)
          const isToday = col.key === formatDate(new Date())

          return (
            <div
              key={col.key}
              className={`min-w-[180px] flex-1 rounded-lg border ${
                isToday ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white'
              } ${draggedId ? 'border-dashed' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-blue-400') }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-blue-400') }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('ring-2', 'ring-blue-400')
                void handleDrop(col.key)
              }}
            >
              {/* Column header */}
              <div className={`px-3 py-2 border-b ${isToday ? 'border-blue-200' : 'border-gray-100'}`}>
                <p className={`text-xs font-semibold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                  {col.label}
                </p>
                {colTotal > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatCHF(colTotal, 'CHF')}
                  </p>
                )}
              </div>

              {/* Invoice cards */}
              <div className="p-2 space-y-2 min-h-[100px]">
                {colInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    draggable
                    onDragStart={() => handleDragStart(inv.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`rounded-lg border border-gray-200 bg-white p-2.5 cursor-grab shadow-sm hover:shadow transition-shadow ${
                      draggedId === inv.id ? 'opacity-50' : ''
                    }`}
                  >
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {inv.sender_name ?? 'Unbekannt'}
                    </p>
                    <p className="text-xs font-mono text-gray-700 mt-0.5">
                      {formatCHF(inv.gross_amount, inv.currency)}
                    </p>
                    {inv.invoice_number && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        Nr. {inv.invoice_number}
                      </p>
                    )}
                    {inv.scheduled_date && inv.scheduled_date !== inv.due_date && (
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        Verschoben von {formatDateDisplay(inv.due_date)}
                      </p>
                    )}
                  </div>
                ))}

                {colInvoices.length === 0 && (
                  <p className="text-[10px] text-gray-300 text-center py-4">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column generation
// ---------------------------------------------------------------------------

interface CalendarColumn {
  key: string   // YYYY-MM-DD (first day of column period)
  label: string
}

function generateColumns(baseDate: Date, viewMode: ViewMode): CalendarColumn[] {
  const columns: CalendarColumn[] = []

  if (viewMode === 'daily') {
    // 7 days starting from baseDate
    for (let i = 0; i < 7; i++) {
      const d = addDays(baseDate, i)
      columns.push({
        key: formatDate(d),
        label: d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      })
    }
  } else if (viewMode === 'weekly') {
    // 4 weeks
    const weekStart = startOfWeek(baseDate)
    for (let i = 0; i < 4; i++) {
      const d = addDays(weekStart, i * 7)
      const end = addDays(d, 6)
      columns.push({
        key: formatDate(d),
        label: `KW ${getWeekNumber(d)} (${formatDateDisplay(formatDate(d))}–${formatDateDisplay(formatDate(end))})`,
      })
    }
  } else {
    // 3 months
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1)
      columns.push({
        key: formatDate(d),
        label: d.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' }),
      })
    }
  }

  return columns
}

function findColumn(
  dateStr: string,
  columns: CalendarColumn[],
  viewMode: ViewMode,
): CalendarColumn | null {
  const date = new Date(dateStr)

  if (viewMode === 'daily') {
    return columns.find((col) => col.key === dateStr) ?? null
  }

  if (viewMode === 'weekly') {
    for (const col of columns) {
      const start = new Date(col.key)
      const end = addDays(start, 7)
      if (date >= start && date < end) return col
    }
    return null
  }

  // Monthly
  for (const col of columns) {
    const colDate = new Date(col.key)
    if (date.getFullYear() === colDate.getFullYear() && date.getMonth() === colDate.getMonth()) {
      return col
    }
  }

  return null
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}
