'use client'

import { useState } from 'react'
import Link from 'next/link'

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
  submitters: Record<string, string>
  approvers: string[]
  count: number
}

const WORKFLOW_STEPS = [
  { key: 'draft', label: 'Entwurf' },
  { key: 'submitted', label: 'Eingereicht' },
  { key: 'under_review', label: 'In Prüfung' },
  { key: 'approved', label: 'Genehmigt' },
  { key: 'exported', label: 'Exportiert' },
]

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-700',
  under_review: 'bg-yellow-100 text-yellow-700',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtAmount(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ApprovalsKpiCard({ count, pendingRuns, submitters, approvers }: Props) {
  const [open, setOpen] = useState(false)

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
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 transition-opacity"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-auto z-10">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ausstehende Genehmigungen</h2>
                <p className="text-sm text-gray-500 mt-0.5">Zahlungsläufe zur Freigabe</p>
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
              {/* Workflow diagram */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Genehmigungsprozess</p>
                <div className="flex items-center gap-1">
                  {WORKFLOW_STEPS.map((step, i) => {
                    const isActive = step.key === 'submitted' || step.key === 'under_review'
                    return (
                      <div key={step.key} className="flex items-center gap-1 flex-1">
                        <div className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {step.label}
                        </div>
                        {i < WORKFLOW_STEPS.length - 1 && (
                          <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Approvers info */}
              {approvers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Genehmigungsberechtigt: <span className="font-medium text-gray-700">{approvers.join(', ')}</span></span>
                </div>
              )}

              {/* Payment run cards */}
              {pendingRuns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-500">Keine ausstehenden Zahlungsläufe.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRuns.map((run) => {
                    const submitterName = run.submitted_by ? submitters[run.submitted_by] : null
                    const statusLabel = run.status === 'submitted' ? 'Eingereicht' : 'In Prüfung'
                    const statusColor = STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-500'

                    return (
                      <Link
                        key={run.id}
                        href={`/finanzplanung/planung/${run.id}`}
                        className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all"
                        onClick={() => setOpen(false)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {run.name ?? `Zahlungslauf ${fmtDate(run.run_date)}`}
                              </p>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{fmtDate(run.run_date)}</span>
                              <span className="font-mono font-medium text-gray-700">{fmtAmount(run.total_amount, run.currency)}</span>
                              <span>{run.item_count} {run.item_count === 1 ? 'Position' : 'Positionen'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {submitterName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Eingereicht von: {submitterName}
                            </span>
                          )}
                          {run.submitted_at && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {fmtDate(run.submitted_at)}
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
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
