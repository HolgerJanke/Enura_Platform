'use client'

import { useState, useTransition } from 'react'
import { submitPaymentRun, approvePaymentRun, rejectPaymentRun } from '../../actions'

interface RunItem {
  id: string
  invoice_id: string
  creditor_name: string
  creditor_iban: string
  amount: number
  currency: string
  payment_reference: string | null
  reviewed_by_planner: boolean
  reviewed_by_approver: boolean
  sort_order: number
}

interface Props {
  runId: string
  status: string
  items: RunItem[]
  canPlan: boolean
  canApprove: boolean
}

export function PaymentRunClient({ runId, status, items, canPlan, canApprove }: Props) {
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set())
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const allReviewed = items.every(item => reviewedItems.has(item.id))

  function handleReview(itemId: string) {
    setReviewedItems(prev => {
      const next = new Set(prev)
      next.add(itemId)
      return next
    })
  }

  function handleSubmit() {
    startTransition(async () => {
      setFeedback(null)
      const result = await submitPaymentRun(runId)
      setFeedback(result.success
        ? { type: 'success', message: 'Zahlungslauf eingereicht.' }
        : { type: 'error', message: result.error ?? 'Fehler.' })
    })
  }

  function handleApprove() {
    startTransition(async () => {
      setFeedback(null)
      const result = await approvePaymentRun(runId)
      setFeedback(result.success
        ? { type: 'success', message: 'Zahlungslauf genehmigt. Zahlungsdatei kann exportiert werden.' }
        : { type: 'error', message: result.error ?? 'Fehler.' })
    })
  }

  function handleReject() {
    if (!rejectReason.trim()) return
    startTransition(async () => {
      setFeedback(null)
      const result = await rejectPaymentRun(runId, rejectReason)
      setFeedback(result.success
        ? { type: 'success', message: 'Zahlungslauf abgelehnt.' }
        : { type: 'error', message: result.error ?? 'Fehler.' })
      setShowRejectDialog(false)
    })
  }

  return (
    <div>
      {/* Items table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Glaeubiger</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">IBAN</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Betrag</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Referenz</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Geprueft</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => {
              const isReviewed = reviewedItems.has(item.id)
              return (
                <tr
                  key={item.id}
                  className={`cursor-pointer transition-colors ${isReviewed ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                  onClick={() => handleReview(item.id)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.creditor_name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">
                    {item.creditor_iban || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                    {item.currency} {Number(item.amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.payment_reference ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {isReviewed ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">✓</span>
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Review progress */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{reviewedItems.size} / {items.length} Positionen geprueft</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${items.length > 0 ? (reviewedItems.size / items.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Klicken Sie auf jede Zeile, um sie als geprueft zu markieren.
          Der Freigabe-Button wird erst aktiv, wenn alle Positionen geprueft wurden.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {/* Planner: submit draft */}
        {status === 'draft' && canPlan && (
          <button
            type="button"
            disabled={isPending || !allReviewed}
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Wird eingereicht...' : 'Zur Genehmigung einreichen'}
          </button>
        )}

        {/* Approver: approve or reject */}
        {['submitted', 'under_review'].includes(status) && canApprove && (
          <>
            <button
              type="button"
              disabled={isPending || !allReviewed}
              onClick={handleApprove}
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Wird genehmigt...' : 'Finale Freigabe'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowRejectDialog(true)}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Ablehnen
            </button>
          </>
        )}

        {/* Export placeholder */}
        {status === 'approved' && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-800">
              Zahlungsdatei-Export (pain.001 / CSV) wird in einem spaeteren Schritt implementiert.
            </p>
          </div>
        )}
      </div>

      {/* Reject dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Zahlungslauf ablehnen</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ablehnungsgrund eingeben..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectDialog(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || isPending}
                onClick={handleReject}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Ablehnen
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {feedback.message}
        </div>
      )}
    </div>
  )
}
