'use client'

import { useState, useTransition } from 'react'
import { overrideCallScoresAction } from './actions'

type ScoreOverrideFormProps = {
  callId: string
  currentScores: {
    greeting: number | null
    objection: number | null
    closing: number | null
    tone: number | null
  }
  onSaved: () => void
  onCancel: () => void
}

export function ScoreOverrideForm({
  callId,
  currentScores,
  onSaved,
  onCancel,
}: ScoreOverrideFormProps) {
  const [greeting, setGreeting] = useState(currentScores.greeting ?? 5)
  const [objection, setObjection] = useState(currentScores.objection ?? 5)
  const [closing, setClosing] = useState(currentScores.closing ?? 5)
  const [tone, setTone] = useState(currentScores.tone ?? 5)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await overrideCallScoresAction({
        callId,
        scores: { greeting, objection, closing, tone },
        notes,
      })

      if (result.error) {
        setError(result.error)
      } else {
        onSaved()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-base font-semibold text-brand-text-primary">
        Bewertung überschreiben
      </h3>

      {error && (
        <div className="rounded-brand bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="override-greeting"
            className="block text-sm font-medium text-brand-text-secondary mb-1"
          >
            Leitfaden
          </label>
          <input
            id="override-greeting"
            type="number"
            min={1}
            max={10}
            value={greeting}
            onChange={(e) => setGreeting(Number(e.target.value))}
            className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            aria-label="Leitfaden Bewertung (1-10)"
          />
        </div>

        <div>
          <label
            htmlFor="override-objection"
            className="block text-sm font-medium text-brand-text-secondary mb-1"
          >
            Einwandbehandlung
          </label>
          <input
            id="override-objection"
            type="number"
            min={1}
            max={10}
            value={objection}
            onChange={(e) => setObjection(Number(e.target.value))}
            className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            aria-label="Einwandbehandlung Bewertung (1-10)"
          />
        </div>

        <div>
          <label
            htmlFor="override-closing"
            className="block text-sm font-medium text-brand-text-secondary mb-1"
          >
            Terminierung
          </label>
          <input
            id="override-closing"
            type="number"
            min={1}
            max={10}
            value={closing}
            onChange={(e) => setClosing(Number(e.target.value))}
            className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            aria-label="Terminierung Bewertung (1-10)"
          />
        </div>

        <div>
          <label
            htmlFor="override-tone"
            className="block text-sm font-medium text-brand-text-secondary mb-1"
          >
            Tonfall
          </label>
          <input
            id="override-tone"
            type="number"
            min={1}
            max={10}
            value={tone}
            onChange={(e) => setTone(Number(e.target.value))}
            className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            aria-label="Tonfall Bewertung (1-10)"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="override-notes"
          className="block text-sm font-medium text-brand-text-secondary mb-1"
        >
          Bemerkungen
        </label>
        <textarea
          id="override-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Grund für die Anpassung..."
          className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          aria-label="Bemerkungen zur Bewertungsanpassung"
        />
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-brand border border-gray-300 px-4 py-2 text-sm font-medium text-brand-text-secondary hover:bg-gray-50 transition-colors disabled:opacity-50"
          aria-label="Abbrechen"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          aria-label="Bewertung speichern"
        >
          {isPending ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}
