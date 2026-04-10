'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveDeploymentAction, rejectDeploymentAction } from '../../deploy/actions'

interface ApprovalControlsProps {
  deploymentId: string
  processId: string
}

export function ApprovalControls({
  deploymentId,
  processId,
}: ApprovalControlsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [approveNotes, setApproveNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveDeploymentAction({
        deploymentId,
        processId,
        notes: approveNotes.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleReject() {
    setError(null)
    if (!rejectReason.trim()) {
      setError('Bitte geben Sie einen Ablehnungsgrund an.')
      return
    }
    startTransition(async () => {
      const result = await rejectDeploymentAction({
        deploymentId,
        processId,
        reason: rejectReason.trim(),
      })
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Freigabe-Entscheidung
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!showRejectForm ? (
        <div className="space-y-4">
          {/* Approval notes */}
          <div>
            <label
              htmlFor="approve-notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Anmerkungen (optional)
            </label>
            <textarea
              id="approve-notes"
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              rows={2}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--brand-primary,#1A56DB)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A56DB)]"
              placeholder="Optionale Anmerkungen zur Freigabe..."
              disabled={isPending}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Deployment freigeben"
            >
              {isPending ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Freigeben
            </button>

            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Deployment ablehnen"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Ablehnen
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Rejection reason (required) */}
          <div>
            <label
              htmlFor="reject-reason"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Ablehnungsgrund <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Bitte begruenden Sie die Ablehnung..."
              disabled={isPending}
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Ablehnung bestaetigen"
            >
              {isPending ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              Ablehnung bestaetigen
            </button>

            <button
              type="button"
              onClick={() => {
                setShowRejectForm(false)
                setRejectReason('')
              }}
              disabled={isPending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              aria-label="Abbrechen"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
