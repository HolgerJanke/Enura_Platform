'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FlowchartView } from '@/components/process-builder/FlowchartView'
import { ListView } from '@/components/process-builder/ListView'
import { StepDetailDrawer } from './step-detail-drawer'
import { EditMode } from './edit-mode'
import type { EnrichedStep, ProcessPageData } from './page'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'flowchart' | 'liste' | 'fortschritt'

interface ProcessDetailClientProps {
  process: ProcessPageData
  steps: EnrichedStep[]
  canEdit: boolean
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'flowchart', label: 'Flowchart' },
  { key: 'liste', label: 'Listenansicht' },
  { key: 'fortschritt', label: 'Fortschritt' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessDetailClient({
  process,
  steps,
  canEdit,
}: ProcessDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('flowchart')
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  // Filter steps by search
  const filteredSteps = useMemo(() => {
    if (!searchQuery.trim()) return steps
    const q = searchQuery.toLowerCase()
    return steps.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.process_step_id.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        s.responsible_roles.some((r) => r.toLowerCase().includes(q)),
    )
  }, [steps, searchQuery])

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  )

  const handleStepClick = (stepId: string) => {
    setSelectedStepId(stepId)
  }

  const handleCloseDrawer = () => {
    setSelectedStepId(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-text-primary,#111827)]">
              {process.name}
            </h1>
            {process.description && (
              <p className="mt-1 text-[var(--brand-text-secondary,#6B7280)]">
                {process.description}
              </p>
            )}
            <div className="mt-1 flex items-center gap-3">
              {process.deployedVersion && (
                <span className="text-xs text-gray-400">
                  Version {process.deployedVersion}
                </span>
              )}
              {canEdit && (
                <Link
                  href={`/processes/${process.id}/versions`}
                  className="text-xs text-[var(--brand-primary,#1A56DB)] hover:underline"
                >
                  Versionshistorie
                </Link>
              )}
            </div>
          </div>

          {/* Edit mode toggle for Super Users */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                editMode
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-[var(--brand-surface,#F9FAFB)] text-[var(--brand-text-secondary,#6B7280)] border border-gray-200 hover:bg-gray-100'
              }`}
              aria-label={editMode ? 'Bearbeitungsmodus beenden' : 'Bearbeitungsmodus starten'}
            >
              {editMode ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              )}
              {editMode ? 'Bearbeitung beenden' : 'Bearbeiten'}
            </button>
          )}
        </div>
      </div>

      {/* Search + Tab bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div
          className="flex rounded-lg border border-gray-200 bg-white p-1 w-fit"
          role="tablist"
          aria-label="Prozessansichten"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--brand-primary,#1A56DB)] text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            placeholder="Schritte suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-[var(--brand-text-primary,#111827)] placeholder-gray-400 focus:border-[var(--brand-primary,#1A56DB)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A56DB)] sm:w-64"
            aria-label="Prozessschritte durchsuchen"
          />
        </div>
      </div>

      {/* Tab panels */}
      {activeTab === 'flowchart' && (
        <div id="panel-flowchart" role="tabpanel" aria-label="Flowchart">
          {editMode ? (
            <EditMode
              processId={process.id}
              steps={filteredSteps}
              viewMode="flowchart"
              onStepClick={handleStepClick}
            />
          ) : (
            <FlowchartView steps={filteredSteps} onStepClick={handleStepClick} />
          )}
        </div>
      )}

      {activeTab === 'liste' && (
        <div id="panel-liste" role="tabpanel" aria-label="Listenansicht">
          {editMode ? (
            <EditMode
              processId={process.id}
              steps={filteredSteps}
              viewMode="liste"
              onStepClick={handleStepClick}
            />
          ) : (
            <ListView steps={filteredSteps} onStepClick={handleStepClick} />
          )}
        </div>
      )}

      {activeTab === 'fortschritt' && (
        <div id="panel-fortschritt" role="tabpanel" aria-label="Fortschritt">
          <ProgressView steps={steps} />
        </div>
      )}

      {/* Step detail drawer */}
      {selectedStep && (
        <StepDetailDrawer step={selectedStep} onClose={handleCloseDrawer} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress view (Fortschritt tab)
// ---------------------------------------------------------------------------

function ProgressView({ steps }: { steps: EnrichedStep[] }) {
  const sortedSteps = [...steps].sort((a, b) => a.sort_order - b.sort_order)
  const totalSteps = sortedSteps.length

  if (totalSteps === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">
          Keine Prozessschritte vorhanden.
        </p>
      </div>
    )
  }

  // Group by main_process
  const groupCounts: Record<string, number> = {}
  for (const step of sortedSteps) {
    const mp = step.main_process ?? 'sonstige'
    groupCounts[mp] = (groupCounts[mp] ?? 0) + 1
  }

  const PROCESS_LABELS: Record<string, string> = {
    vertrieb: 'Vertrieb',
    planung: 'Planung',
    abwicklung: 'Abwicklung',
    service: 'Service',
    sonstige: 'Sonstige',
  }

  const PROCESS_COLORS: Record<string, string> = {
    vertrieb: 'bg-[var(--brand-primary,#1A56DB)]',
    planung: 'bg-amber-500',
    abwicklung: 'bg-teal-500',
    service: 'bg-purple-500',
    sonstige: 'bg-gray-400',
  }

  // Steps with liquidity
  const liquiditySteps = sortedSteps.filter((s) => s.liquidity !== null)
  const totalLiquidityIncome = liquiditySteps
    .filter((s) => s.liquidity?.direction === 'income')
    .reduce((sum, s) => sum + (s.liquidity?.plan_amount ?? 0), 0)
  const totalLiquidityExpense = liquiditySteps
    .filter((s) => s.liquidity?.direction === 'expense')
    .reduce((sum, s) => sum + (s.liquidity?.plan_amount ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]">
            Gesamtschritte
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--brand-text-primary,#111827)]">
            {totalSteps}
          </p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">
            Geplante Einnahmen
          </p>
          <p className="mt-1 text-2xl font-bold text-green-800">
            {formatAmount(totalLiquidityIncome)} CHF
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">
            Geplante Ausgaben
          </p>
          <p className="mt-1 text-2xl font-bold text-red-800">
            {formatAmount(totalLiquidityExpense)} CHF
          </p>
        </div>
      </div>

      {/* Distribution by main_process */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-[var(--brand-text-primary,#111827)]">
          Verteilung nach Hauptprozess
        </h3>

        {/* Progress bar */}
        <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-gray-100">
          {Object.entries(groupCounts).map(([key, count]) => (
            <div
              key={key}
              className={`${PROCESS_COLORS[key] ?? 'bg-gray-400'} transition-all`}
              style={{ width: `${(count / totalSteps) * 100}%` }}
              title={`${PROCESS_LABELS[key] ?? key}: ${count} Schritte`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {Object.entries(groupCounts).map(([key, count]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${PROCESS_COLORS[key] ?? 'bg-gray-400'}`}
              />
              <span className="text-xs text-[var(--brand-text-secondary,#6B7280)]">
                {PROCESS_LABELS[key] ?? key}: {count} ({Math.round((count / totalSteps) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Liquidity timeline */}
      {liquiditySteps.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-[var(--brand-text-primary,#111827)]">
            Liquiditätsereignisse
          </h3>
          <div className="space-y-3">
            {liquiditySteps.map((step) => (
              <div
                key={step.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
                    {step.process_step_id}
                  </span>
                  <span className="text-sm font-medium text-[var(--brand-text-primary,#111827)]">
                    {step.name}
                  </span>
                </div>
                {step.liquidity && (
                  <span
                    className={`text-sm font-semibold ${
                      step.liquidity.direction === 'income'
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    {step.liquidity.direction === 'income' ? '+' : '-'}
                    {formatAmount(step.liquidity.plan_amount ?? 0)}{' '}
                    {step.liquidity.plan_currency}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
