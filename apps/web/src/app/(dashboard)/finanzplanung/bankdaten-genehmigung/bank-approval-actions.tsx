'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewBankDataChange, approveBankDataChange } from '../actions'

interface Props {
  requestId: string
  mode: 'review' | 'approve'
}

export function BankApprovalActions({ requestId, mode }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleAction(action: 'review' | 'approve' | 'reject') {
    setLoading(true)
    setError(null)

    const result = mode === 'review'
      ? await reviewBankDataChange(requestId, action === 'reject' ? 'reject' : 'review', comment || undefined)
      : await approveBankDataChange(requestId, action === 'reject' ? 'reject' : 'approve', comment || undefined)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Fehler bei der Verarbeitung.')
      return
    }

    router.refresh()
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
      )}

      {showReject ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ablehnungsgrund..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
          <button
            type="button"
            onClick={() => handleAction('reject')}
            disabled={loading || !comment.trim()}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={() => { setShowReject(false); setComment('') }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAction(mode)}
            disabled={loading}
            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Verarbeite...' : mode === 'review' ? 'Pruefung bestanden' : 'Genehmigen'}
          </button>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={loading}
            className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Ablehnen
          </button>
        </div>
      )}
    </div>
  )
}
