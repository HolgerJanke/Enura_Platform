'use client'

import { useState } from 'react'
import { formatDateTime, formatDuration } from '@enura/types'
import { CallAnalysisPanel } from './call-analysis-panel'

type CallData = {
  id: string
  started_at: string
  duration_seconds: number
  direction: string
  status: string
  recording_url: string | null
}

type AnalysisData = {
  call_id: string
  overall_score: number | null
  greeting_score: number | null
  needs_analysis_score: number | null
  presentation_score: number | null
  closing_score: number | null
  suggestions: Record<string, unknown> | null
  analyzed_at: string | null
}

type RecentCallsTableProps = {
  calls: CallData[]
  analyses: AnalysisData[]
  canOverride: boolean
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'answered':
      return {
        label: 'Angenommen',
        className: 'bg-green-100 text-green-700',
      }
    case 'missed':
      return {
        label: 'Verpasst',
        className: 'bg-red-100 text-red-700',
      }
    case 'voicemail':
      return {
        label: 'Voicemail',
        className: 'bg-yellow-100 text-yellow-700',
      }
    case 'busy':
      return {
        label: 'Besetzt',
        className: 'bg-orange-100 text-orange-700',
      }
    case 'failed':
      return {
        label: 'Fehlgeschlagen',
        className: 'bg-gray-100 text-gray-700',
      }
    default:
      return {
        label: status,
        className: 'bg-gray-100 text-gray-700',
      }
  }
}

function getScoreBadge(score: number | null): { label: string; className: string } {
  if (score === null) {
    return {
      label: 'Ausstehend',
      className: 'bg-gray-100 text-gray-500',
    }
  }
  if (score >= 8) {
    return {
      label: 'Sehr gut',
      className: 'bg-green-100 text-green-700',
    }
  }
  if (score >= 5) {
    return {
      label: 'Gut',
      className: 'bg-yellow-100 text-yellow-700',
    }
  }
  return {
    label: 'Verbesserung',
    className: 'bg-red-100 text-red-700',
  }
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'outbound') {
    return (
      <span
        className="inline-flex items-center gap-1 text-sm text-brand-text-primary"
        title="Ausgehend"
      >
        <svg
          className="h-4 w-4 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
        <span className="sr-only">Ausgehend</span>
        Ausgehend
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-sm text-brand-text-primary"
      title="Eingehend"
    >
      <svg
        className="h-4 w-4 text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16l-4-4m0 0l4-4m-4 4h18"
        />
      </svg>
      <span className="sr-only">Eingehend</span>
      Eingehend
    </span>
  )
}

export function RecentCallsTable({
  calls,
  analyses,
  canOverride,
}: RecentCallsTableProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)

  const analysisMap = new Map<string, AnalysisData>()
  for (const a of analyses) {
    analysisMap.set(a.call_id, a)
  }

  const selectedCall = calls.find((c) => c.id === selectedCallId) ?? null
  const selectedAnalysis = selectedCallId
    ? analysisMap.get(selectedCallId) ?? null
    : null

  if (calls.length === 0) {
    return (
      <div className="rounded-brand bg-brand-surface p-6 text-center border border-gray-200">
        <p className="text-sm text-brand-text-secondary">
          Keine Anrufe in den letzten 30 Tagen.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-brand border border-gray-200 bg-brand-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-brand-text-secondary"
              >
                Datum/Zeit
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-brand-text-secondary"
              >
                Dauer
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-brand-text-secondary"
              >
                Richtung
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-brand-text-secondary"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-brand-text-secondary"
              >
                Bewertung
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-brand-text-secondary">
                <span className="sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => {
              const analysis = analysisMap.get(call.id)
              const statusBadge = getStatusBadge(call.status)
              const scoreBadge = getScoreBadge(analysis?.overall_score ?? null)

              return (
                <tr
                  key={call.id}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-brand-text-primary whitespace-nowrap">
                    {formatDateTime(call.started_at)}
                  </td>
                  <td className="px-4 py-3 text-brand-text-primary whitespace-nowrap">
                    {formatDuration(call.duration_seconds)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DirectionIcon direction={call.direction} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadge.className}`}
                    >
                      {analysis?.overall_score !== null && analysis?.overall_score !== undefined && (
                        <span className="font-bold">{analysis.overall_score}</span>
                      )}
                      {scoreBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedCallId(call.id)}
                      className="rounded-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                      aria-label={`Details für Anruf vom ${formatDateTime(call.started_at)} anzeigen`}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Analysis slide-over panel */}
      {selectedCall && (
        <CallAnalysisPanel
          call={selectedCall}
          analysis={selectedAnalysis}
          canOverride={canOverride}
          onClose={() => setSelectedCallId(null)}
        />
      )}
    </>
  )
}
