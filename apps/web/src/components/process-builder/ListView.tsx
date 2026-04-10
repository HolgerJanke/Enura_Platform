'use client'

import { useState, useCallback } from 'react'
import type { EnrichedStep } from '@/app/(dashboard)/processes/[id]/page'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  super_user: 'Super User',
  geschaeftsfuehrung: 'Geschäftsführung',
  teamleiter: 'Teamleiter',
  setter: 'Setter',
  berater: 'Berater',
  innendienst: 'Innendienst',
  bau: 'Bau / Montage',
  buchhaltung: 'Buchhaltung',
  leadkontrolle: 'Leadkontrolle',
}

const MAIN_PROCESS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  vertrieb: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Vertrieb' },
  planung: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Planung' },
  abwicklung: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Abwicklung' },
  service: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Service' },
}

const TIMELINE_DOT_COLORS: Record<string, string> = {
  vertrieb: 'border-[var(--brand-primary,#1A56DB)] bg-blue-50',
  planung: 'border-amber-400 bg-amber-50',
  abwicklung: 'border-teal-400 bg-teal-50',
  service: 'border-purple-400 bg-purple-50',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ListViewProps {
  steps: EnrichedStep[]
  onStepClick?: (stepId: string) => void
}

export function ListView({ steps, onStepClick }: ListViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const sortedSteps = [...steps].sort((a, b) => a.sort_order - b.sort_order)

  const handleToggle = useCallback((stepId: string) => {
    setExpandedId((prev) => (prev === stepId ? null : stepId))
  }, [])

  const handleStepClick = useCallback(
    (stepId: string) => {
      if (onStepClick) onStepClick(stepId)
    },
    [onStepClick],
  )

  if (sortedSteps.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">
          Keine Prozessschritte vorhanden.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div
        className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"
        aria-hidden="true"
      />

      <div className="space-y-4">
        {sortedSteps.map((step) => {
          const isLiquidity = step.liquidity_marker !== null
          const isExpanded = expandedId === step.id
          const mp = step.main_process ?? 'sonstige'
          const dotClass = TIMELINE_DOT_COLORS[mp] ?? 'border-gray-300 bg-white'
          const badge = MAIN_PROCESS_BADGES[mp]

          return (
            <div key={step.id} className="relative pl-14">
              {/* Timeline dot */}
              <div
                className={`absolute left-4 top-4 h-5 w-5 rounded-full border-2 ${dotClass}`}
                aria-hidden="true"
              />

              {/* Card */}
              <div
                className={`rounded-lg border transition-shadow ${
                  isLiquidity
                    ? 'border-dashed border-amber-300 bg-amber-50/50'
                    : 'border-gray-200 bg-white'
                } ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}
              >
                {/* Clickable header */}
                <button
                  type="button"
                  className="w-full p-4 text-left"
                  onClick={() => handleToggle(step.id)}
                  aria-expanded={isExpanded}
                  aria-label={`Schritt ${step.process_step_id}: ${step.name}`}
                >
                  {/* Top row: ID badge + name + main_process + liquidity */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
                        {step.process_step_id}
                      </span>
                      {badge && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-[var(--brand-text-primary,#111827)]">
                        {step.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Liquidity amount */}
                      {step.liquidity && step.liquidity.plan_amount !== null && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            step.liquidity.direction === 'income'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {step.liquidity.direction === 'income' ? '+' : '-'}
                          {formatAmount(step.liquidity.plan_amount)}{' '}
                          {step.liquidity.plan_currency}
                        </span>
                      )}

                      {/* Expand chevron */}
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Description (always visible) */}
                  {step.description && (
                    <p className="text-sm text-[var(--brand-text-secondary,#6B7280)] mb-2 line-clamp-2">
                      {step.description}
                    </p>
                  )}

                  {/* Compact metadata row */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Responsible roles */}
                    {step.responsible_roles.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">Verantwortlich:</span>
                        <div className="flex flex-wrap gap-1">
                          {step.responsible_roles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center rounded-full bg-[var(--brand-surface,#F9FAFB)] px-2 py-0.5 text-xs font-medium text-[var(--brand-text-primary,#111827)] border border-gray-200"
                            >
                              {ROLE_LABELS[role] ?? role}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sources */}
                    {step.sources.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">Quellen:</span>
                        <div className="flex flex-wrap gap-1">
                          {step.sources.map((source, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-700 border border-purple-200"
                            >
                              {source.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interface count */}
                    {step.interfaces.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                        {step.interfaces.length}{' '}
                        {step.interfaces.length === 1
                          ? 'Schnittstelle'
                          : 'Schnittstellen'}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {/* Expected output */}
                    {step.expected_output && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                          Erwartetes Ergebnis
                        </p>
                        <p className="text-sm text-[var(--brand-text-primary,#111827)]">
                          {step.expected_output}
                        </p>
                      </div>
                    )}

                    {/* Sources detail */}
                    {step.sources.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                          Datenquellen
                        </p>
                        <div className="space-y-1.5">
                          {step.sources.map((src) => (
                            <div
                              key={src.id}
                              className="flex items-center gap-2 text-sm text-[var(--brand-text-secondary,#6B7280)]"
                            >
                              <span className="inline-flex h-5 w-8 items-center justify-center rounded bg-purple-100 text-[9px] font-bold text-purple-700">
                                {src.source_type.toUpperCase().slice(0, 4)}
                              </span>
                              <span>{src.label}</span>
                              {src.tool_name && (
                                <span className="text-xs text-gray-400">({src.tool_name})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interfaces detail */}
                    {step.interfaces.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                          Schnittstellen
                        </p>
                        <div className="space-y-1.5">
                          {step.interfaces.map((iface) => (
                            <div
                              key={iface.id}
                              className="flex items-center gap-2 text-sm text-[var(--brand-text-secondary,#6B7280)]"
                            >
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  iface.interface_type === 'inbound'
                                    ? 'bg-blue-100 text-blue-700'
                                    : iface.interface_type === 'outbound'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {iface.interface_type === 'inbound'
                                  ? 'IN'
                                  : iface.interface_type === 'outbound'
                                    ? 'OUT'
                                    : 'BI'}
                              </span>
                              <span>{iface.label}</span>
                              {iface.endpoint && (
                                <span className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
                                  {iface.endpoint}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Open detail drawer button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStepClick(step.id)
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-primary,#1A56DB)] hover:bg-gray-50 transition-colors"
                      aria-label={`Details für ${step.name} öffnen`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Alle Details anzeigen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
