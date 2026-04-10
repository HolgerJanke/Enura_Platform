'use client'

import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepSnapshot {
  id: string
  process_step_id: string
  name: string
  description: string | null
  responsible_roles: string[]
  sort_order: number
  show_in_flowchart: boolean
  liquidity_marker: string | null
  sources: Array<{ label: string; source_type: string }>
  interfaces: Array<{ label: string; interface_type: string }>
}

interface VersionSnapshot {
  steps: StepSnapshot[]
}

interface DiffViewerProps {
  currentSnapshot: VersionSnapshot | null
  newSnapshot: VersionSnapshot | null
  currentVersion: string | null
  newVersion: string
}

type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged'

interface StepDiff {
  stepId: string
  name: string
  status: DiffStatus
  currentStep: StepSnapshot | null
  newStep: StepSnapshot | null
  changes: string[]
}

// ---------------------------------------------------------------------------
// Diff computation
// ---------------------------------------------------------------------------

function computeStepDiffs(
  current: VersionSnapshot | null,
  next: VersionSnapshot | null,
): StepDiff[] {
  const currentSteps = current?.steps ?? []
  const newSteps = next?.steps ?? []

  const currentMap = new Map(
    currentSteps.map((s) => [s.process_step_id, s]),
  )
  const newMap = new Map(newSteps.map((s) => [s.process_step_id, s]))

  const allStepIds = new Set([
    ...currentSteps.map((s) => s.process_step_id),
    ...newSteps.map((s) => s.process_step_id),
  ])

  const diffs: StepDiff[] = []

  for (const stepId of allStepIds) {
    const currentStep = currentMap.get(stepId) ?? null
    const newStep = newMap.get(stepId) ?? null

    if (!currentStep && newStep) {
      diffs.push({
        stepId,
        name: newStep.name,
        status: 'added',
        currentStep: null,
        newStep,
        changes: ['Neuer Schritt hinzugefügt'],
      })
    } else if (currentStep && !newStep) {
      diffs.push({
        stepId,
        name: currentStep.name,
        status: 'removed',
        currentStep,
        newStep: null,
        changes: ['Schritt entfernt'],
      })
    } else if (currentStep && newStep) {
      const changes: string[] = []

      if (currentStep.name !== newStep.name) {
        changes.push(`Name: "${currentStep.name}" -> "${newStep.name}"`)
      }
      if (currentStep.description !== newStep.description) {
        changes.push('Beschreibung geändert')
      }
      if (
        JSON.stringify(currentStep.responsible_roles) !==
        JSON.stringify(newStep.responsible_roles)
      ) {
        changes.push('Verantwortliche Rollen geändert')
      }
      if (currentStep.show_in_flowchart !== newStep.show_in_flowchart) {
        changes.push(
          `Flowchart-Sichtbarkeit: ${currentStep.show_in_flowchart ? 'Ja' : 'Nein'} -> ${newStep.show_in_flowchart ? 'Ja' : 'Nein'}`,
        )
      }
      if (currentStep.liquidity_marker !== newStep.liquidity_marker) {
        changes.push('Liquiditäts-Marker geändert')
      }
      if (currentStep.sort_order !== newStep.sort_order) {
        changes.push(
          `Sortierung: ${currentStep.sort_order} -> ${newStep.sort_order}`,
        )
      }
      if (
        JSON.stringify(currentStep.sources) !==
        JSON.stringify(newStep.sources)
      ) {
        changes.push('Datenquellen geändert')
      }
      if (
        JSON.stringify(currentStep.interfaces) !==
        JSON.stringify(newStep.interfaces)
      ) {
        changes.push('Schnittstellen geändert')
      }

      diffs.push({
        stepId,
        name: newStep.name,
        status: changes.length > 0 ? 'changed' : 'unchanged',
        currentStep,
        newStep,
        changes,
      })
    }
  }

  // Sort by new step sort_order, then removed steps at the end
  diffs.sort((a, b) => {
    const aOrder = a.newStep?.sort_order ?? a.currentStep?.sort_order ?? 999
    const bOrder = b.newStep?.sort_order ?? b.currentStep?.sort_order ?? 999
    return aOrder - bOrder
  })

  return diffs
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiffViewer({
  currentSnapshot,
  newSnapshot,
  currentVersion,
  newVersion,
}: DiffViewerProps) {
  const diffs = useMemo(
    () => computeStepDiffs(currentSnapshot, newSnapshot),
    [currentSnapshot, newSnapshot],
  )

  const addedCount = diffs.filter((d) => d.status === 'added').length
  const removedCount = diffs.filter((d) => d.status === 'removed').length
  const changedCount = diffs.filter((d) => d.status === 'changed').length

  if (!newSnapshot) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">
          Kein Versions-Snapshot verfügbar für diese Version.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-sm text-gray-600">
          {currentVersion ? `v${currentVersion}` : 'Keine'} → v{newVersion}
        </span>
        <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
        {addedCount > 0 && (
          <span className="text-sm font-medium text-green-700">
            +{addedCount} neu
          </span>
        )}
        {removedCount > 0 && (
          <span className="text-sm font-medium text-red-700">
            -{removedCount} entfernt
          </span>
        )}
        {changedCount > 0 && (
          <span className="text-sm font-medium text-amber-700">
            ~{changedCount} geändert
          </span>
        )}
        {addedCount === 0 && removedCount === 0 && changedCount === 0 && (
          <span className="text-sm text-gray-500">Keine Änderungen</span>
        )}
      </div>

      {/* Step-by-step diff */}
      <div className="space-y-3">
        {diffs.map((diff) => (
          <StepDiffCard key={diff.stepId} diff={diff} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step diff card
// ---------------------------------------------------------------------------

function StepDiffCard({ diff }: { diff: StepDiff }) {
  const borderColor: Record<DiffStatus, string> = {
    added: 'border-l-green-500',
    removed: 'border-l-red-500',
    changed: 'border-l-amber-500',
    unchanged: 'border-l-gray-200',
  }

  const bgColor: Record<DiffStatus, string> = {
    added: 'bg-green-50',
    removed: 'bg-red-50',
    changed: 'bg-amber-50',
    unchanged: 'bg-white',
  }

  const statusLabel: Record<DiffStatus, string> = {
    added: 'Neu',
    removed: 'Entfernt',
    changed: 'Geändert',
    unchanged: 'Unverändert',
  }

  const statusBadgeColor: Record<DiffStatus, string> = {
    added: 'bg-green-100 text-green-800',
    removed: 'bg-red-100 text-red-800',
    changed: 'bg-amber-100 text-amber-800',
    unchanged: 'bg-gray-100 text-gray-600',
  }

  return (
    <div
      className={`rounded-lg border border-l-4 ${borderColor[diff.status]} ${bgColor[diff.status]} p-4`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
            {diff.stepId}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {diff.name}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor[diff.status]}`}
        >
          {statusLabel[diff.status]}
        </span>
      </div>

      {diff.changes.length > 0 && diff.status !== 'unchanged' && (
        <ul className="mt-2 space-y-1">
          {diff.changes.map((change, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
              {change}
            </li>
          ))}
        </ul>
      )}

      {/* Side-by-side source/interface comparison for changed steps */}
      {diff.status === 'changed' && diff.currentStep && diff.newStep && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          {/* Sources comparison */}
          {JSON.stringify(diff.currentStep.sources) !== JSON.stringify(diff.newStep.sources) && (
            <>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-1">
                  Quellen (vorher)
                </p>
                {diff.currentStep.sources.length === 0 ? (
                  <p className="text-xs text-gray-400">Keine</p>
                ) : (
                  <ul className="space-y-0.5">
                    {diff.currentStep.sources.map((s, i) => (
                      <li key={i} className="text-xs text-red-700 line-through">
                        {s.label} ({s.source_type})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-1">
                  Quellen (nachher)
                </p>
                {diff.newStep.sources.length === 0 ? (
                  <p className="text-xs text-gray-400">Keine</p>
                ) : (
                  <ul className="space-y-0.5">
                    {diff.newStep.sources.map((s, i) => (
                      <li key={i} className="text-xs text-green-700">
                        {s.label} ({s.source_type})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {/* Interfaces comparison */}
          {JSON.stringify(diff.currentStep.interfaces) !== JSON.stringify(diff.newStep.interfaces) && (
            <>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-1">
                  Schnittstellen (vorher)
                </p>
                {diff.currentStep.interfaces.length === 0 ? (
                  <p className="text-xs text-gray-400">Keine</p>
                ) : (
                  <ul className="space-y-0.5">
                    {diff.currentStep.interfaces.map((iface, i) => (
                      <li key={i} className="text-xs text-red-700 line-through">
                        {iface.label} ({iface.interface_type})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-1">
                  Schnittstellen (nachher)
                </p>
                {diff.newStep.interfaces.length === 0 ? (
                  <p className="text-xs text-gray-400">Keine</p>
                ) : (
                  <ul className="space-y-0.5">
                    {diff.newStep.interfaces.map((iface, i) => (
                      <li key={i} className="text-xs text-green-700">
                        {iface.label} ({iface.interface_type})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
