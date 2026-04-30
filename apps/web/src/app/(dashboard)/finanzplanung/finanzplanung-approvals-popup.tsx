'use client'

import { useState } from 'react'
import Link from 'next/link'

interface RunItem {
  id: string
  invoice_id: string
  creditor_name: string
  amount: number
  currency: string
  invoice_number: string | null
  invoice_status: string | null
  due_date: string | null
}

interface PendingRun {
  id: string
  name: string | null
  run_date: string
  total_amount: number
  item_count: number
  currency: string
  status: string
  submitted_by: string | null
  submitted_at: string | null
}

interface Props {
  pendingRuns: PendingRun[]
  runItems: Record<string, RunItem[]>
  submitters: Record<string, string>
  approvers: string[]
  count: number
}

const APPROVAL_STEPS = [
  {
    key: 'submitted',
    label: 'Eingereicht',
    description: 'Vom Planer eingereicht, wartet auf Prüfung',
    color: 'border-amber-200 bg-amber-50',
    badgeColor: 'bg-amber-100 text-amber-700',
    dotColor: 'bg-amber-400',
  },
  {
    key: 'under_review',
    label: 'In Prüfung',
    description: 'Wird vom Genehmiger geprüft',
    color: 'border-yellow-200 bg-yellow-50',
    badgeColor: 'bg-yellow-100 text-yellow-700',
    dotColor: 'bg-yellow-400',
  },
]

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtAmount(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ApprovalsKpiCard({ count, pendingRuns, runItems, submitters, approvers }: Props) {
  const [open, setOpen] = useState(false)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-200 bg-amber-50 p-5 hover:shadow-md hover:border-amber-300 transition-all text-left w-full"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
            <svg className="h-4.5 w-4.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900">Genehmigungen</p>
        </div>
        <p className="text-3xl font-bold text-amber-600">{count}</p>
        <p className="text-xs text-gray-500 mt-1">ausstehende Zahlungsläufe</p>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
          <div
            className="fixed inset-0 bg-black/40 transition-opacity"
            onClick={() => setOpen(false)}
          />

          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-auto z-10">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ausstehende Genehmigungen</h2>
                <p className="text-sm text-gray-500 mt-0.5">Zahlungsläufe nach Genehmigungsschritt</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Schliessen"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Workflow overview */}
              <div className="flex items-center gap-2">
                {APPROVAL_STEPS.map((step, i) => {
                  const stepRuns = pendingRuns.filter(r => r.status === step.key)
                  return (
                    <div key={step.key} className="flex items-center gap-2 flex-1">
                      <div className={`flex-1 rounded-lg border px-4 py-2.5 ${step.color}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${step.dotColor}`} />
                            <span className="text-sm font-semibold text-gray-900">{step.label}</span>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${step.badgeColor}`}>
                            {stepRuns.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">{step.description}</p>
                      </div>
                      {i < APPROVAL_STEPS.length - 1 && (
                        <svg className="h-5 w-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Approvers info */}
              {approvers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Genehmigungsberechtigt: <span className="font-medium text-gray-700">{approvers.join(', ')}</span></span>
                </div>
              )}

              {/* Runs grouped by approval step */}
              {APPROVAL_STEPS.map((step) => {
                const stepRuns = pendingRuns.filter(r => r.status === step.key)
                if (stepRuns.length === 0) return null

                return (
                  <div key={step.key}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${step.dotColor}`} />
                      <h3 className="text-sm font-semibold text-gray-900">{step.label}</h3>
                      <span className="text-xs text-gray-400">({stepRuns.length})</span>
                    </div>

                    <div className="space-y-3">
                      {stepRuns.map((run) => {
                        const submitterName = run.submitted_by ? submitters[run.submitted_by] : null
                        const items = runItems[run.id] ?? []
                        const isExpanded = expandedRun === run.id

                        return (
                          <div key={run.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            {/* Run card header — click to expand invoices */}
                            <button
                              type="button"
                              onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                              className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <svg className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                      {run.name ?? `Zahlungslauf ${fmtDate(run.run_date)}`}
                                    </p>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${step.badgeColor}`}>
                                      {step.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-gray-500 ml-6">
                                    <span className="font-mono font-medium text-gray-700">{fmtAmount(run.total_amount, run.currency)}</span>
                                    <span>{run.item_count} {run.item_count === 1 ? 'Rechnung' : 'Rechnungen'}</span>
                                    <span>{fmtDate(run.run_date)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Tags */}
                              <div className="flex flex-wrap gap-2 mt-2.5 ml-6">
                                {submitterName && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Eingereicht von: {submitterName}
                                  </span>
                                )}
                                {approvers.length > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Genehmigung bei: {approvers.join(', ')}
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Expanded: Invoice list */}
                            {isExpanded && (
                              <div className="border-t border-gray-100 bg-gray-50">
                                {items.length === 0 ? (
                                  <p className="text-xs text-gray-400 text-center py-4">Keine Rechnungsdaten verfügbar.</p>
                                ) : (
                                  <table className="min-w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-200">
                                        <th className="px-4 py-2 text-left text-gray-500 font-medium">Nr.</th>
                                        <th className="px-4 py-2 text-left text-gray-500 font-medium">Lieferant</th>
                                        <th className="px-4 py-2 text-right text-gray-500 font-medium">Betrag</th>
                                        <th className="px-4 py-2 text-left text-gray-500 font-medium">Fälligkeit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-white transition-colors">
                                          <td className="px-4 py-2 font-mono text-blue-600">
                                            <Link
                                              href={`/finanzplanung/eingang/${item.invoice_id}`}
                                              className="hover:underline"
                                              onClick={() => setOpen(false)}
                                            >
                                              {item.invoice_number ?? '—'}
                                            </Link>
                                          </td>
                                          <td className="px-4 py-2 text-gray-900">{item.creditor_name}</td>
                                          <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtAmount(item.amount, item.currency)}</td>
                                          <td className="px-4 py-2 text-gray-500">{fmtDate(item.due_date)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                {/* Link to full run detail */}
                                <div className="px-4 py-2 border-t border-gray-200">
                                  <Link
                                    href={`/finanzplanung/planung/${run.id}`}
                                    className="text-xs text-blue-600 hover:underline font-medium"
                                    onClick={() => setOpen(false)}
                                  >
                                    Zahlungslauf öffnen →
                                  </Link>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {pendingRuns.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-500">Keine ausstehenden Zahlungsläufe.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
