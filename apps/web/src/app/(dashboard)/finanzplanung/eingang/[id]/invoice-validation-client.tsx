'use client'

import { useState, useTransition } from 'react'
import { performValidationAction } from '../../actions'

interface Props {
  invoiceId: string
  currentStep: number
  status: string
  canValidate: boolean
  canApprove: boolean
  dueDate: string | null
}

const STEP_LABELS = ['Formale Prüfung', 'Inhaltliche Prüfung', 'Technische Genehmigung']

export function InvoiceValidationClient({ invoiceId, currentStep, status, canValidate, canApprove, dueDate }: Props) {
  const [comment, setComment] = useState('')
  const [dateOverride, setDateOverride] = useState(dueDate ?? '')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const isTerminal = ['approved', 'paid', 'scheduled', 'in_payment_run'].includes(status)
  const isReturned = status.includes('returned')

  function handleAction(step: 1 | 2 | 3, action: string) {
    startTransition(async () => {
      setFeedback(null)
      const result = await performValidationAction(
        invoiceId,
        step,
        action,
        comment || undefined,
        action === 'due_date_override' ? dateOverride : undefined,
      )
      if (result.success) {
        setFeedback({ type: 'success', message: 'Aktion erfolgreich ausgeführt.' })
        setComment('')
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler.' })
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Validierungs-Workflow</h2>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1
          const isActive = !isTerminal && stepNum === currentStep
          const isDone = isTerminal || stepNum < currentStep
          return (
            <div key={stepNum} className="flex items-center gap-1.5">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                isDone ? 'bg-green-500 text-white' :
                isActive ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {isDone ? '✓' : stepNum}
              </div>
              <span className={`text-xs ${isActive ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                {label}
              </span>
              {i < 2 && <div className="h-px w-4 bg-gray-300" />}
            </div>
          )
        })}
      </div>

      {isTerminal && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          Rechnung vollständig validiert und genehmigt.
        </div>
      )}

      {isReturned && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          Rechnung zurückgesendet. Warten auf Korrektur.
        </div>
      )}

      {/* Step 1: Formal check */}
      {currentStep === 1 && canValidate && !isTerminal && !isReturned && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Prüfen Sie die formalen Pflichtangaben der Rechnung.</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kommentar (optional)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleAction(1, 'formal_pass')}
              className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Formal OK → Weiter
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleAction(1, 'formal_return')}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Zurücksenden
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Content check */}
      {currentStep === 2 && canValidate && !isTerminal && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Prüfen Sie den Inhalt und das Fälligkeitsdatum.</p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Fälligkeitsdatum</label>
            <input
              type="date"
              value={dateOverride}
              onChange={(e) => setDateOverride(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kommentar (optional)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const action = dateOverride !== dueDate ? 'due_date_override' : 'content_pass'
                handleAction(2, action)
              }}
              className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Inhalt OK → Genehmigung
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleAction(2, 'content_return')}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Zurücksenden
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Technical approval */}
      {currentStep === 3 && canApprove && !isTerminal && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Technische Freigabe der geprüften Rechnung.</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kommentar (optional)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleAction(3, 'approve')}
              className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Genehmigen
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleAction(3, 'reject')}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Ablehnen
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {feedback.message}
        </div>
      )}
    </div>
  )
}
