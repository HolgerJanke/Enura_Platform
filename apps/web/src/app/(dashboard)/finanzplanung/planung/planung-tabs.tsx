'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CashoutCalendar } from './cashout-calendar-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceItem {
  id: string
  invoice_number: string | null
  sender_name: string | null
  gross_amount: number
  currency: string
  due_date: string
  scheduled_date: string | null
}

interface PaymentRun {
  id: string
  run_date: string
  name: string | null
  total_amount: number
  item_count: number
  currency: string
  status: string
}

interface RawInvoice {
  id: string
  invoice_number: string | null
  sender_name: string | null
  gross_amount: number | null
  currency: string
  due_date: string | null
}

type TabKey = 'kalender' | 'zahlungslaeufe' | 'rechnungen'

interface Props {
  invoices: RawInvoice[]
  activeRuns: PaymentRun[]
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'kalender', label: 'Kalender' },
  { key: 'zahlungslaeufe', label: 'Zahlungsläufe' },
  { key: 'rechnungen', label: 'Rechnungsliste' },
]

const RUN_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  submitted: 'Eingereicht',
  under_review: 'In Prüfung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  exported: 'Exportiert',
  confirmed_paid: 'Bezahlt',
}

const RUN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  exported: 'bg-blue-100 text-blue-700',
  confirmed_paid: 'bg-gray-100 text-gray-500',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanungTabs({ invoices, activeRuns }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('kalender')

  const calendarInvoices: InvoiceItem[] = invoices.map(inv => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    sender_name: inv.sender_name,
    gross_amount: Number(inv.gross_amount ?? 0),
    currency: inv.currency,
    due_date: inv.due_date ?? new Date().toISOString().split('T')[0]!,
    scheduled_date: null,
  }))

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.key === 'zahlungslaeufe' && activeRuns.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                {activeRuns.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Kalender */}
      {activeTab === 'kalender' && (
        <div>
          {calendarInvoices.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">Keine genehmigten Rechnungen zur Terminierung vorhanden.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Verschieben Sie Rechnungskarten per Drag-and-Drop in eine andere Datumsspalte, um das Zahlungsdatum zu ändern.
              </p>
              <CashoutCalendar invoices={calendarInvoices} />
            </>
          )}
        </div>
      )}

      {/* Tab: Zahlungsläufe */}
      {activeTab === 'zahlungslaeufe' && (
        <div>
          {activeRuns.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">Keine aktiven Zahlungsläufe vorhanden.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/finanzplanung/planung/${run.id}`}
                  className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {run.name ?? `Zahlungslauf ${run.run_date}`}
                    </h3>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RUN_STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {RUN_STATUS_LABELS[run.status] ?? run.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{run.currency} {Number(run.total_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
                    <span>{run.item_count} Positionen</span>
                    <span>{new Date(run.run_date).toLocaleDateString('de-CH')}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Rechnungsliste */}
      {activeTab === 'rechnungen' && (
        <div>
          {invoices.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">Keine genehmigten Rechnungen vorhanden.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nr.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Gläubiger</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Betrag</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Fälligkeit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((inv) => {
                    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date()
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{inv.invoice_number ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{inv.sender_name ?? 'Unbekannt'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                          {inv.currency} {Number(inv.gross_amount ?? 0).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString('de-CH') : '—'}
                          {isOverdue ? ' (überfällig)' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
