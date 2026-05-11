'use client'

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BotTestRunnerProps = {
  botId: string
  botName: string
  companyId: string
  exampleInput: Record<string, unknown>
}

type RunResult = {
  jobId?: string
  botId?: string
  status: 'completed' | 'failed'
  output?: Record<string, unknown>
  error?: string
  durationMs?: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BotTestRunner({ botId, botName, companyId, exampleInput }: BotTestRunnerProps) {
  const [input, setInput] = useState<string>(JSON.stringify(exampleInput, null, 2))
  const [result, setResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runBot = useCallback(async () => {
    setRunning(true)
    setResult(null)
    setError(null)

    const start = Date.now()

    try {
      // Parse the input
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(input)
      } catch {
        setError('Ungültiges JSON im Input-Feld.')
        setRunning(false)
        return
      }

      // Call the bot API via our proxy route
      const res = await fetch(`/api/bots/${botId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, input: parsed }),
      })

      const data = await res.json()
      const elapsed = Date.now() - start

      if (!res.ok) {
        setError(data.error ?? `Fehler ${res.status}: ${res.statusText}`)
      } else {
        setResult({ ...data, durationMs: data.durationMs ?? elapsed })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setRunning(false)
    }
  }, [botId, companyId, input])

  const loadExample = () => {
    setInput(JSON.stringify(exampleInput, null, 2))
    setResult(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* Input editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">
            Input (JSON)
          </label>
          {Object.keys(exampleInput).length > 0 && (
            <button
              type="button"
              onClick={loadExample}
              className="text-[11px] font-medium text-brand-primary hover:underline"
            >
              Beispiel laden
            </button>
          )}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs text-brand-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none resize-y"
          placeholder='{"key": "value"}'
        />
      </div>

      {/* Run button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runBot}
          disabled={running}
          className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all ${
            running
              ? 'bg-brand-primary/60 cursor-not-allowed'
              : 'bg-brand-primary hover:bg-brand-primary/90 shadow-sm hover:shadow'
          }`}
        >
          {running ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Läuft...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {botName} ausführen
            </>
          )}
        </button>
        {result?.durationMs && (
          <span className="text-xs text-brand-text-secondary">
            {(result.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Fehler</p>
          <p className="text-xs text-red-700 mt-1 font-mono whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${result.status === 'completed' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className={`text-sm font-medium ${result.status === 'completed' ? 'text-green-700' : 'text-red-700'}`}>
              {result.status === 'completed' ? 'Erfolgreich' : 'Fehlgeschlagen'}
            </span>
          </div>
          {result.output && (
            <div>
              <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-2">
                Ergebnis
              </p>
              <pre className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs font-mono text-brand-text-primary overflow-x-auto max-h-[500px] overflow-y-auto">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}
          {result.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs text-red-700 font-mono whitespace-pre-wrap">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
