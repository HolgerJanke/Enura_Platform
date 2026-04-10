'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { formatCHF, formatDate } from '@enura/types'
import { saveManualEntry } from './actions'
import type { ManualEntryInput } from './actions'

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
  budget_amount: string | null
  budget_date: string | null
  actual_date: string | null
  actual_currency: string | null
  actual_amount: string | null
  actual_source: string | null
  amount_deviation: string | null
  date_deviation_days: number | null
  trigger_activated_at: string | null
  notes: string | null
}

interface Props {
  event: LiquidityEvent
  companyId: string
  projectName: string
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManualEntryDrawer({ event, companyId, projectName, onClose }: Props) {
  const planAmount = Number(event.budget_amount ?? 0)
  const planCurrency = event.plan_currency

  const [actualDate, setActualDate] = useState(
    event.actual_date ?? new Date().toISOString().split('T')[0]!,
  )
  const [actualAmount, setActualAmount] = useState(
    event.actual_amount ? Number(event.actual_amount) : planAmount,
  )
  const [actualCurrency, setActualCurrency] = useState(
    event.actual_currency ?? planCurrency,
  )
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [notes, setNotes] = useState(event.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)

  const showFxRate = actualCurrency !== planCurrency

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setSaving(true)

      const input: ManualEntryInput = {
        eventInstanceId: event.id,
        companyId,
        actualDate,
        actualAmount,
        actualCurrency,
        fxRate: showFxRate ? fxRate : null,
        notes: notes.trim() || null,
      }

      const result = await saveManualEntry(input)
      setSaving(false)

      if (!result.success) {
        setError(result.error ?? 'Unbekannter Fehler.')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1200)
    },
    [event.id, companyId, actualDate, actualAmount, actualCurrency, fxRate, notes, showFxRate, onClose],
  )

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-brand-background shadow-xl transition-transform"
        role="dialog"
        aria-modal="true"
        aria-label="Ist-Wert erfassen"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-brand-text-primary">
              Ist-Wert erfassen
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-brand p-1 text-brand-text-secondary hover:bg-gray-100 transition-colors"
              aria-label="Schließen"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Context info */}
            <div className="mb-6 rounded-brand bg-brand-surface border border-gray-200 p-4">
              <p className="text-sm font-medium text-brand-text-primary">{projectName}</p>
              <p className="text-sm text-brand-text-secondary mt-1">{event.step_name}</p>
              <div className="mt-2 flex items-center gap-4 text-xs text-brand-text-secondary">
                <span>
                  {event.direction === 'income' ? 'Einnahme' : 'Ausgabe'}
                </span>
                <span>Plan: {event.budget_date ? formatDate(event.budget_date) : '–'}</span>
                <span>Plan: {formatCHF(planAmount)}</span>
              </div>
            </div>

            {success ? (
              <div className="rounded-brand bg-green-50 border border-green-200 p-4 text-center">
                <p className="text-sm font-medium text-green-800">
                  Ist-Wert erfolgreich gespeichert.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Actual date */}
                <div>
                  <label
                    htmlFor="actual-date"
                    className="block text-sm font-medium text-brand-text-primary mb-1"
                  >
                    Ist-Datum
                  </label>
                  <input
                    id="actual-date"
                    type="date"
                    required
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                    className="w-full rounded-brand border border-gray-200 bg-brand-surface px-3 py-2 text-sm text-brand-text-primary"
                  />
                </div>

                {/* Actual amount */}
                <div>
                  <label
                    htmlFor="actual-amount"
                    className="block text-sm font-medium text-brand-text-primary mb-1"
                  >
                    Ist-Betrag
                  </label>
                  <input
                    id="actual-amount"
                    type="number"
                    required
                    min={0}
                    step={0.01}
                    value={actualAmount}
                    onChange={(e) => setActualAmount(Number(e.target.value))}
                    className="w-full rounded-brand border border-gray-200 bg-brand-surface px-3 py-2 text-sm text-brand-text-primary tabular-nums"
                  />
                </div>

                {/* Actual currency */}
                <div>
                  <label
                    htmlFor="actual-currency"
                    className="block text-sm font-medium text-brand-text-primary mb-1"
                  >
                    Waehrung
                  </label>
                  <select
                    id="actual-currency"
                    value={actualCurrency}
                    onChange={(e) => setActualCurrency(e.target.value)}
                    className="w-full rounded-brand border border-gray-200 bg-brand-surface px-3 py-2 text-sm text-brand-text-primary"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                {/* FX rate (only if currencies differ) */}
                {showFxRate && (
                  <div>
                    <label
                      htmlFor="fx-rate"
                      className="block text-sm font-medium text-brand-text-primary mb-1"
                    >
                      Wechselkurs ({actualCurrency}/{planCurrency})
                    </label>
                    <input
                      id="fx-rate"
                      type="number"
                      min={0}
                      step={0.0001}
                      value={fxRate ?? ''}
                      onChange={(e) =>
                        setFxRate(e.target.value ? Number(e.target.value) : null)
                      }
                      placeholder="z.B. 0.9450"
                      className="w-full rounded-brand border border-gray-200 bg-brand-surface px-3 py-2 text-sm text-brand-text-primary tabular-nums"
                    />
                    <p className="mt-1 text-xs text-brand-text-secondary">
                      Bitte geben Sie den Umrechnungskurs ein, um den Betrag in {planCurrency} zu berechnen.
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-medium text-brand-text-primary mb-1"
                  >
                    Bemerkungen
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optionale Bemerkungen..."
                    className="w-full rounded-brand border border-gray-200 bg-brand-surface px-3 py-2 text-sm text-brand-text-primary"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-brand bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-brand bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? 'Speichern...' : 'Speichern'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-brand border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-text-primary transition-colors hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
