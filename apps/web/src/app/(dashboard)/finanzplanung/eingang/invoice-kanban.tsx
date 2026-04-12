'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { scheduleInvoicePayment } from '../actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceCard {
  id: string
  invoice_number: string | null
  sender_name: string | null
  gross_amount: number | null
  currency: string
  due_date: string | null
  planned_payment_date: string | null
  status: string
}

interface Props {
  invoices: InvoiceCard[]
  canDrag: boolean
}

// ---------------------------------------------------------------------------
// Status display
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  received: 'Eingegangen',
  extraction_done: 'Extrahiert',
  match_review: 'Match-Prüfung',
  in_validation: 'In Prüfung',
  returned_formal: 'Zurückgesendet',
  formally_approved: 'Formal genehmigt',
  pending_approval: 'Genehmigung ausstehend',
  returned_internal: 'Interne Korrektur',
  returned_sender: 'An Absender',
  approved: 'Genehmigt',
  scheduled: 'Geplant',
  in_payment_run: 'Im Zahlungslauf',
  paid: 'Bezahlt',
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  extraction_done: 'bg-blue-100 text-blue-700',
  match_review: 'bg-amber-100 text-amber-700',
  in_validation: 'bg-yellow-100 text-yellow-700',
  returned_formal: 'bg-red-100 text-red-700',
  formally_approved: 'bg-indigo-100 text-indigo-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  returned_internal: 'bg-orange-100 text-orange-700',
  returned_sender: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-teal-100 text-teal-700',
  in_payment_run: 'bg-cyan-100 text-cyan-700',
  paid: 'bg-gray-100 text-gray-500',
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function formatCHF(amount: number): string {
  return `CHF ${amount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface Column {
  key: string
  label: string
  headerClass: string
  droppable: boolean
  dropDate: string | null // Monday ISO date when dropping here
}

function buildColumns(): Column[] {
  const today = new Date()
  const thisMonday = startOfWeek(today)
  const columns: Column[] = []

  // 1. Bezahlt
  columns.push({
    key: 'paid',
    label: 'Bezahlt',
    headerClass: 'bg-gray-100 text-gray-600',
    droppable: false,
    dropDate: null,
  })

  // 2. Zurückgesendet
  columns.push({
    key: 'returned',
    label: 'Zurückgesendet',
    headerClass: 'bg-orange-100 text-orange-700',
    droppable: false,
    dropDate: null,
  })

  // 3. Überfällig
  columns.push({
    key: 'overdue',
    label: 'Überfällig',
    headerClass: 'bg-red-100 text-red-700',
    droppable: false,
    dropDate: null,
  })

  // 3–6. Current week + 3 more weeks
  for (let i = 0; i < 4; i++) {
    const monday = addDays(thisMonday, i * 7)
    const friday = addDays(monday, 4)
    const kw = getWeekNumber(monday)
    const label = i === 0
      ? `KW ${kw} (${formatDateDisplay(monday)} – ${formatDateDisplay(friday)})`
      : `KW ${kw} (${formatDateDisplay(monday)} – ${formatDateDisplay(friday)})`
    columns.push({
      key: `week-${i}`,
      label,
      headerClass: i === 0 ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-900',
      droppable: true,
      dropDate: formatDate(monday),
    })
  }

  // 7. Später
  columns.push({
    key: 'later',
    label: 'Später',
    headerClass: 'bg-gray-50 text-gray-600',
    droppable: true,
    dropDate: formatDate(addDays(thisMonday, 28)), // 4 weeks out
  })

  return columns
}

function assignColumn(inv: InvoiceCard): string {
  if (inv.status === 'paid') return 'paid'
  if (inv.status.includes('returned')) return 'returned'

  // Use planned_payment_date if set, otherwise fall back to due_date
  const effectiveDate = inv.planned_payment_date ?? inv.due_date
  if (!effectiveDate) return 'later'

  const payDate = new Date(effectiveDate)
  payDate.setHours(0, 0, 0, 0)
  const thisMonday = startOfWeek(new Date())

  // Overdue: payment date before this week's Monday
  if (payDate < thisMonday) return 'overdue'

  // Check each week column
  for (let i = 0; i < 4; i++) {
    const weekStart = addDays(thisMonday, i * 7)
    const weekEnd = addDays(weekStart, 7)
    if (payDate >= weekStart && payDate < weekEnd) return `week-${i}`
  }

  return 'later'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceKanban({ invoices, canDrag }: Props) {
  const router = useRouter()
  const [localInvoices, setLocalInvoices] = useState(invoices)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const draggedIdRef = useRef<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'returned'>('all')
  const wasDragging = useRef(false)

  const columns = buildColumns()

  // Group invoices into columns
  const grouped = new Map<string, InvoiceCard[]>()
  for (const col of columns) grouped.set(col.key, [])
  for (const inv of localInvoices) {
    const colKey = assignColumn(inv)
    const arr = grouped.get(colKey) ?? []
    arr.push(inv)
    grouped.set(colKey, arr)
  }

  function handleDragStart(id: string) {
    draggedIdRef.current = id
    setDraggedId(id)
  }

  async function handleDrop(col: Column) {
    const id = draggedIdRef.current
    if (!id || !col.droppable || !col.dropDate) return
    draggedIdRef.current = null
    setDraggedId(null)

    // Optimistic update — set planned_payment_date, keep due_date unchanged
    setLocalInvoices(prev => prev.map(inv =>
      inv.id === id ? { ...inv, planned_payment_date: col.dropDate } : inv,
    ))

    const result = await scheduleInvoicePayment(id, col.dropDate!)
    if (result.success) {
      setFeedback('Zahlungsdatum aktualisiert.')
      setTimeout(() => setFeedback(null), 2000)
    } else {
      setFeedback(result.error ?? 'Fehler beim Aktualisieren.')
      setLocalInvoices(invoices)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  // Summary stats
  const allOpen = localInvoices.filter(i => i.status !== 'paid')
  const totalOpen = allOpen.reduce((s, i) => s + Number(i.gross_amount ?? 0), 0)
  const overdueInvoices = grouped.get('overdue') ?? []
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.gross_amount ?? 0), 0)
  const thisWeekInvoices = grouped.get('week-0') ?? []
  const totalThisWeek = thisWeekInvoices.reduce((s, i) => s + Number(i.gross_amount ?? 0), 0)
  const returnedInvoices = grouped.get('returned') ?? []

  return (
    <div>
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Offen gesamt</p>
          <p className="text-lg font-bold text-gray-900">{formatCHF(totalOpen)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{allOpen.length} Rechnungen</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Diese Woche</p>
          <p className="text-lg font-bold text-gray-900">{formatCHF(totalThisWeek)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{thisWeekInvoices.length} Rechnungen</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">Überfällig</p>
          <p className="text-lg font-bold text-red-700">{formatCHF(totalOverdue)}</p>
          <p className="text-xs text-red-400 mt-0.5">{overdueInvoices.length} Rechnungen</p>
        </div>
        {returnedInvoices.length > 0 && (
          <button
            type="button"
            onClick={() => setFilter(filter === 'returned' ? 'all' : 'returned')}
            className={`rounded-lg border p-4 text-left transition-colors ${
              filter === 'returned' ? 'border-orange-400 bg-orange-100 ring-2 ring-orange-300' : 'border-orange-200 bg-orange-50'
            }`}
          >
            <p className="text-xs text-orange-600">Zurückgesendet</p>
            <p className="text-lg font-bold text-orange-700">{returnedInvoices.length}</p>
            <p className="text-xs text-orange-400 mt-0.5">{filter === 'returned' ? 'Filter aktiv' : 'Klicken zum Filtern'}</p>
          </button>
        )}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Bezahlt</p>
          <p className="text-lg font-bold text-gray-900">{(grouped.get('paid') ?? []).length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Rechnungen</p>
        </div>
      </div>

      {/* Filter indicator */}
      {filter === 'returned' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 p-3">
          <p className="text-sm text-orange-700 flex-1">Filter: Nur zurückgesendete Rechnungen</p>
          <button type="button" onClick={() => setFilter('all')} className="text-xs text-orange-600 hover:text-orange-800 font-medium">
            Filter aufheben ×
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{feedback}</div>
      )}

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.filter(col => filter === 'all' || col.key === 'returned').map((col) => {
          const colInvoices = grouped.get(col.key) ?? []
          const colTotal = colInvoices.reduce((s, i) => s + Number(i.gross_amount ?? 0), 0)

          return (
            <div
              key={col.key}
              className={`min-w-[200px] flex-1 rounded-lg border border-gray-200 ${
                draggedId && col.droppable ? 'border-dashed border-blue-300' : ''
              }`}
              onDragOver={(e) => {
                if (!col.droppable) return
                e.preventDefault()
                e.currentTarget.classList.add('ring-2', 'ring-blue-400')
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-blue-400')
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('ring-2', 'ring-blue-400')
                if (col.droppable) void handleDrop(col)
              }}
            >
              {/* Column header */}
              <div className={`px-3 py-2.5 rounded-t-lg border-b border-gray-100 ${col.headerClass}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{col.label}</p>
                  <span className="text-[10px] font-medium opacity-70">{colInvoices.length}</span>
                </div>
                {colTotal > 0 && (
                  <p className="text-xs opacity-70 mt-0.5">{formatCHF(colTotal)}</p>
                )}
              </div>

              {/* Cards */}
              <div
                className="p-2 space-y-2 min-h-[120px] max-h-[60vh] overflow-y-auto"
                onDragOver={(e) => { if (col.droppable) e.preventDefault() }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.parentElement?.classList.remove('ring-2', 'ring-blue-400')
                  if (col.droppable) void handleDrop(col)
                }}
              >
                {colInvoices.length === 0 ? (
                  <p className="text-[10px] text-gray-300 text-center py-6">—</p>
                ) : (
                  colInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      draggable={canDrag && inv.status !== 'paid'}
                      onDragStart={(e) => {
                        if (!canDrag) { e.preventDefault(); return }
                        wasDragging.current = true
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', inv.id)
                        handleDragStart(inv.id)
                      }}
                      onDragEnd={() => { setTimeout(() => { setDraggedId(null); wasDragging.current = false }, 50) }}
                      onClick={() => {
                        if (wasDragging.current) return
                        router.push(`/finanzplanung/eingang/${inv.id}`)
                      }}
                      className={`rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm hover:shadow transition-shadow cursor-pointer ${
                        canDrag && inv.status !== 'paid' ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${draggedId === inv.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {inv.sender_name ?? 'Unbekannt'}
                      </p>
                      <p className="text-xs font-mono text-gray-700 mt-0.5">
                        {formatCHF(Number(inv.gross_amount ?? 0))}
                      </p>
                      {inv.invoice_number && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          Nr. {inv.invoice_number}
                        </p>
                      )}
                      {inv.due_date && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Fällig: {new Date(inv.due_date).toLocaleDateString('de-CH')}
                        </p>
                      )}
                      {inv.planned_payment_date && inv.planned_payment_date !== inv.due_date && (
                        <p className="text-[10px] text-blue-500 mt-0.5">
                          Zahlung: {new Date(inv.planned_payment_date).toLocaleDateString('de-CH')}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
