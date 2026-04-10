'use client'

import { useEffect, useCallback } from 'react'
import type { EnrichedStep } from './page'

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

const SOURCE_TYPE_ICONS: Record<string, { icon: string; label: string }> = {
  api: { icon: 'API', label: 'API' },
  database: { icon: 'DB', label: 'Datenbank' },
  file: { icon: 'FILE', label: 'Datei' },
  manual: { icon: 'MAN', label: 'Manuell' },
  webhook: { icon: 'WH', label: 'Webhook' },
  calculated: { icon: 'CALC', label: 'Berechnet' },
}

const INTERFACE_TYPE_LABELS: Record<string, string> = {
  inbound: 'Eingehend',
  outbound: 'Ausgehend',
  bidirectional: 'Bidirektional',
}

const KNOWN_TOOL_URLS: Record<string, string> = {
  reonic: 'https://app.reonic.com',
  bexio: 'https://office.bexio.com',
  '3cx': 'https://login.3cx.net',
  google_calendar: 'https://calendar.google.com',
  leadnotes: 'https://app.leadnotes.io',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepDetailDrawerProps {
  step: EnrichedStep
  onClose: () => void
}

export function StepDetailDrawer({ step, onClose }: StepDetailDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const mainProcessLabel: Record<string, string> = {
    vertrieb: 'Vertrieb',
    planung: 'Planung',
    abwicklung: 'Abwicklung',
    service: 'Service',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Drawer schließen"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClose()
        }}
      />

      {/* Drawer panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Schrittdetails: ${step.name}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
              {step.process_step_id}
            </span>
            {step.main_process && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getMainProcessBadgeClass(step.main_process)}`}
              >
                {mainProcessLabel[step.main_process] ?? step.main_process}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Schließen"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Name + Description */}
          <div>
            <h2 className="text-lg font-semibold text-[var(--brand-text-primary,#111827)]">
              {step.name}
            </h2>
            {step.description && (
              <p className="mt-2 text-sm text-[var(--brand-text-secondary,#6B7280)] leading-relaxed">
                {step.description}
              </p>
            )}
          </div>

          {/* Expected output */}
          {step.expected_output && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]">
                Erwartetes Ergebnis
              </h3>
              <p className="text-sm text-[var(--brand-text-primary,#111827)]">
                {step.expected_output}
              </p>
            </div>
          )}

          {/* Responsible roles */}
          {step.responsible_roles.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]">
                Verantwortliche Rollen
              </h3>
              <div className="flex flex-wrap gap-2">
                {step.responsible_roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center rounded-full bg-[var(--brand-surface,#F9FAFB)] px-3 py-1 text-xs font-medium text-[var(--brand-text-primary,#111827)] border border-gray-200"
                  >
                    {ROLE_LABELS[role] ?? role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {step.sources.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]">
                Datenquellen
              </h3>
              <div className="space-y-2">
                {step.sources.map((source) => {
                  const typeInfo = SOURCE_TYPE_ICONS[source.source_type] ?? {
                    icon: '?',
                    label: source.source_type,
                  }
                  const toolUrl = source.tool_name
                    ? KNOWN_TOOL_URLS[source.tool_name.toLowerCase()] ?? null
                    : null

                  return (
                    <div
                      key={source.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-7 w-10 items-center justify-center rounded bg-purple-100 text-[10px] font-bold text-purple-700">
                          {typeInfo.icon}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-[var(--brand-text-primary,#111827)]">
                            {source.label}
                          </p>
                          {source.description && (
                            <p className="text-xs text-gray-500">
                              {source.description}
                            </p>
                          )}
                          {source.tool_name && (
                            <p className="text-xs text-gray-400">
                              Tool: {source.tool_name}
                            </p>
                          )}
                        </div>
                      </div>
                      {toolUrl && (
                        <a
                          href={toolUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-primary,#1A56DB)] hover:bg-gray-50 transition-colors"
                          aria-label={`${source.tool_name} in Tool öffnen`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          In Tool öffnen
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Interfaces (read-only summary) */}
          {step.interfaces.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]">
                Schnittstellen ({step.interfaces.length})
              </h3>
              <div className="space-y-2">
                {step.interfaces.map((iface) => (
                  <div
                    key={iface.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          iface.interface_type === 'inbound'
                            ? 'bg-blue-100 text-blue-700'
                            : iface.interface_type === 'outbound'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {INTERFACE_TYPE_LABELS[iface.interface_type] ?? iface.interface_type}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--brand-text-primary,#111827)]">
                          {iface.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {iface.protocol.toUpperCase()}
                          {iface.endpoint ? ` - ${iface.endpoint}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liquidity */}
          {step.liquidity && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]">
                Liquidität
              </h3>
              <div
                className={`rounded-lg border p-4 ${
                  step.liquidity.direction === 'income'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      {step.liquidity.direction === 'income' ? 'Einnahme' : 'Ausgabe'} ({step.liquidity.marker_type === 'trigger' ? 'Auslöser' : 'Ereignis'})
                    </p>
                  </div>
                  {step.liquidity.plan_amount !== null && (
                    <p
                      className={`text-lg font-bold ${
                        step.liquidity.direction === 'income'
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {step.liquidity.direction === 'income' ? '+' : '-'}
                      {formatAmount(step.liquidity.plan_amount)}{' '}
                      {step.liquidity.plan_currency}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMainProcessBadgeClass(mainProcess: string): string {
  switch (mainProcess) {
    case 'vertrieb':
      return 'bg-blue-100 text-blue-800'
    case 'planung':
      return 'bg-amber-100 text-amber-800'
    case 'abwicklung':
      return 'bg-teal-100 text-teal-800'
    case 'service':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
