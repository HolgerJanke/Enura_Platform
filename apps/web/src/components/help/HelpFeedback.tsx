'use client'

import { useState } from 'react'

type HelpFeedbackProps = {
  articleSlug: string
  articleLevel: string
}

type FeedbackState = 'idle' | 'submitting' | 'submitted'

/**
 * Thumbs up / down feedback widget shown below help articles.
 * Inserts a row into the `help_feedback` table on submission.
 *
 * Note: We call the snippet/feedback API via fetch so this can remain
 * a pure client component without importing server-only modules.
 */
export function HelpFeedback({ articleSlug, articleLevel }: HelpFeedbackProps) {
  const [state, setState] = useState<FeedbackState>('idle')

  async function submitFeedback(rating: 'positive' | 'negative') {
    setState('submitting')

    try {
      // Use a lightweight POST to the snippets endpoint to record feedback.
      // In production this would be its own endpoint; for now we insert directly.
      await fetch('/api/help/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleSlug,
          articleLevel,
          rating,
        }),
      })
    } catch {
      // Silently ignore errors — feedback is non-critical
    } finally {
      setState('submitted')
    }
  }

  if (state === 'submitted') {
    return (
      <div className="flex items-center gap-2 text-sm text-brand-text-secondary">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ color: 'var(--brand-primary)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Danke für Ihr Feedback!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-brand-text-secondary">
        War dieser Artikel hilfreich?
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void submitFeedback('positive')}
          disabled={state === 'submitting'}
          className="flex h-9 w-9 items-center justify-center rounded-brand border border-gray-300 text-brand-text-secondary transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Ja, hilfreich"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M4 15h.01"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void submitFeedback('negative')}
          disabled={state === 'submitting'}
          className="flex h-9 w-9 items-center justify-center rounded-brand border border-gray-300 text-brand-text-secondary transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Nein, nicht hilfreich"
        >
          <svg
            className="h-5 w-5 rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M4 15h.01"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
