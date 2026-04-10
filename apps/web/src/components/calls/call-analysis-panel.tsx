'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDateTime, formatDuration } from '@enura/types'
import { ScoreOverrideForm } from './score-override-form'

type Analysis = {
  call_id: string
  overall_score: number | null
  greeting_score: number | null
  needs_analysis_score: number | null
  presentation_score: number | null
  closing_score: number | null
  suggestions: Record<string, unknown> | null
  analyzed_at: string | null
}

type CallAnalysisPanelProps = {
  call: {
    id: string
    started_at: string
    duration_seconds: number
    direction: string
    status: string
    recording_url: string | null
  }
  analysis: Analysis | null
  canOverride: boolean
  onClose: () => void
}

type FeedbackTab = 'leitfaden' | 'einwände' | 'terminierung' | 'tonfall'

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-200'
  if (score >= 8) return 'bg-green-500'
  if (score >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreTextColor(score: number | null): string {
  if (score === null) return 'text-gray-400'
  if (score >= 8) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreLabel(score: number | null): string {
  if (score === null) return 'Ausstehend'
  if (score >= 8) return 'Sehr gut'
  if (score >= 5) return 'Gut'
  return 'Verbesserung'
}

function ScoreBar({
  label,
  score,
  animate,
}: {
  label: string
  score: number | null
  animate: boolean
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (animate && score !== null) {
      // Delay to trigger CSS transition from 0 to target width
      const timer = setTimeout(() => {
        setWidth(score * 10)
      }, 50)
      return () => clearTimeout(timer)
    } else if (score !== null) {
      setWidth(score * 10)
    }
  }, [score, animate])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-brand-text-primary">{label}</span>
        <span className={`font-semibold ${getScoreTextColor(score)}`}>
          {score !== null ? `${score}/10` : '-'}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${getScoreColor(score)}`}
          style={{
            width: `${width}%`,
            transition: 'width 600ms ease-out',
          }}
        />
      </div>
    </div>
  )
}

const FEEDBACK_TABS: Array<{ key: FeedbackTab; label: string }> = [
  { key: 'leitfaden', label: 'Leitfaden' },
  { key: 'einwände', label: 'Einwände' },
  { key: 'terminierung', label: 'Terminierung' },
  { key: 'tonfall', label: 'Tonfall' },
]

function getFeedbackForTab(
  suggestions: Record<string, unknown> | null,
  tab: FeedbackTab,
): string {
  if (!suggestions) return 'Keine Analyse vorhanden.'

  const feedbackMap: Record<FeedbackTab, string> = {
    leitfaden: 'greeting_feedback',
    einwände: 'objection_feedback',
    terminierung: 'closing_feedback',
    tonfall: 'tone_feedback',
  }

  const key = feedbackMap[tab]
  const value = suggestions[key]
  if (typeof value === 'string' && value.length > 0) return value
  return 'Kein detailliertes Feedback vorhanden.'
}

export function CallAnalysisPanel({
  call,
  analysis,
  canOverride,
  onClose,
}: CallAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<FeedbackTab>('leitfaden')
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  const strengths = analysis?.suggestions?.strengths
  const strengthsList = Array.isArray(strengths) ? (strengths as string[]) : []

  const improvements = analysis?.suggestions?.improvements
  const improvementsList = Array.isArray(improvements) ? (improvements as string[]) : []

  const summary =
    typeof analysis?.suggestions?.summary === 'string'
      ? analysis.suggestions.summary
      : null

  const transcript =
    typeof analysis?.suggestions?.transcript === 'string'
      ? analysis.suggestions.transcript
      : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Panel schließen"
      />

      {/* Slide-over panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-brand-background shadow-xl transition-transform duration-300 ease-in-out"
        role="dialog"
        aria-modal="true"
        aria-label="Anrufanalyse Details"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-text-primary">
              Anruf vom {formatDateTime(call.started_at)}
            </h2>
            <p className="text-sm text-brand-text-secondary">
              Dauer: {formatDuration(call.duration_seconds)}
              {' · '}
              {call.direction === 'outbound' ? 'Ausgehend' : 'Eingehend'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-brand p-2 text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary transition-colors"
            aria-label="Panel schließen"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {!analysis ? (
            <div className="rounded-brand bg-gray-50 p-6 text-center">
              <p className="text-sm text-brand-text-secondary">
                Für diesen Anruf liegt noch keine Analyse vor.
              </p>
            </div>
          ) : (
            <>
              {/* Overall score */}
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white ${getScoreColor(analysis.overall_score)}`}
                >
                  {analysis.overall_score ?? '-'}
                </div>
                <div>
                  <p className="text-lg font-semibold text-brand-text-primary">
                    Gesamtbewertung
                  </p>
                  <p className={`text-sm font-medium ${getScoreTextColor(analysis.overall_score)}`}>
                    {getScoreLabel(analysis.overall_score)}
                  </p>
                </div>
              </div>

              {/* Overall progress bar */}
              <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreColor(analysis.overall_score)}`}
                  style={{
                    width: mounted && analysis.overall_score !== null
                      ? `${analysis.overall_score * 10}%`
                      : '0%',
                    transition: 'width 600ms ease-out',
                  }}
                />
              </div>

              {/* Dimension scores */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-brand-text-primary uppercase tracking-wide">
                  Einzelbewertungen
                </h3>
                <ScoreBar
                  label="Leitfaden"
                  score={analysis.greeting_score}
                  animate={mounted}
                />
                <ScoreBar
                  label="Einwandbehandlung"
                  score={analysis.needs_analysis_score}
                  animate={mounted}
                />
                <ScoreBar
                  label="Terminierung"
                  score={analysis.presentation_score}
                  animate={mounted}
                />
                <ScoreBar
                  label="Tonfall"
                  score={analysis.closing_score}
                  animate={mounted}
                />
              </div>

              {/* Strengths */}
              {strengthsList.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-brand-text-primary uppercase tracking-wide mb-2">
                    Staerken
                  </h3>
                  <ul className="space-y-1">
                    {strengthsList.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-brand-text-primary"
                      >
                        <span className="mt-0.5 text-green-500" aria-hidden="true">
                          +
                        </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {improvementsList.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-brand-text-primary uppercase tracking-wide mb-2">
                    Verbesserungsvorschlaege
                  </h3>
                  <ul className="space-y-1">
                    {improvementsList.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-brand-text-primary"
                      >
                        <span className="mt-0.5 text-yellow-500" aria-hidden="true">
                          !
                        </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feedback tabs */}
              <div>
                <h3 className="text-sm font-semibold text-brand-text-primary uppercase tracking-wide mb-2">
                  Detailliertes Feedback
                </h3>
                <div
                  className="flex gap-1 border-b border-gray-200"
                  role="tablist"
                  aria-label="Feedback-Kategorien"
                >
                  {FEEDBACK_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.key}
                      aria-controls={`feedback-panel-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === tab.key
                          ? 'border-[var(--brand-primary)] text-brand-text-primary'
                          : 'border-transparent text-brand-text-secondary hover:text-brand-text-primary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div
                  id={`feedback-panel-${activeTab}`}
                  role="tabpanel"
                  className="mt-3 rounded-brand bg-brand-surface p-4 text-sm text-brand-text-primary leading-relaxed"
                >
                  {getFeedbackForTab(analysis.suggestions, activeTab)}
                </div>
              </div>

              {/* Summary */}
              {summary && (
                <div>
                  <h3 className="text-sm font-semibold text-brand-text-primary uppercase tracking-wide mb-2">
                    Zusammenfassung
                  </h3>
                  <p className="text-sm text-brand-text-primary leading-relaxed">
                    {summary}
                  </p>
                </div>
              )}

              {/* Transcript */}
              {transcript && (
                <div>
                  <h3 className="text-sm font-semibold text-brand-text-primary uppercase tracking-wide mb-2">
                    Transkript
                  </h3>
                  <div
                    className="max-h-[300px] overflow-y-auto rounded-brand bg-gray-50 p-4 text-xs font-mono text-brand-text-primary leading-relaxed whitespace-pre-wrap"
                    tabIndex={0}
                    aria-label="Anruf-Transkript"
                  >
                    {transcript}
                  </div>
                </div>
              )}

              {/* Override section */}
              {canOverride && (
                <div className="border-t border-gray-200 pt-4">
                  {showOverrideForm ? (
                    <ScoreOverrideForm
                      callId={call.id}
                      currentScores={{
                        greeting: analysis.greeting_score,
                        objection: analysis.needs_analysis_score,
                        closing: analysis.presentation_score,
                        tone: analysis.closing_score,
                      }}
                      onSaved={() => {
                        setShowOverrideForm(false)
                        // Close and let the page re-fetch data
                        onClose()
                      }}
                      onCancel={() => setShowOverrideForm(false)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowOverrideForm(true)}
                      className="w-full rounded-brand border border-gray-300 px-4 py-2.5 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors"
                      aria-label="Bewertung überschreiben"
                    >
                      Bewertung überschreiben
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
