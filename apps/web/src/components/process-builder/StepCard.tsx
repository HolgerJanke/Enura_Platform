'use client'

import { useState, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  ProcessStepRow,
  ProcessStepSourceRow,
  ProcessStepInterfaceRow,
  ProcessStepLiquidityRow,
  ToolRegistryRow,
} from '@enura/types'
import { SourcesPanel } from './SourcesPanel'
import { InterfacesPanel } from './InterfacesPanel'
import { LiquidityPanel } from './LiquidityPanel'
import {
  updateStepAction,
  deleteStepAction,
  addStepAction,
} from '@/app/(holding)/admin/processes/[id]/actions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAIN_PROCESS_OPTIONS = [
  { value: 'vertrieb', label: 'Vertrieb' },
  { value: 'planung', label: 'Planung' },
  { value: 'abwicklung', label: 'Abwicklung' },
  { value: 'service', label: 'Service' },
] as const

const ALL_ROLES = [
  { key: 'super_user', label: 'Super User' },
  { key: 'geschaeftsfuehrung', label: 'Geschäftsführung' },
  { key: 'teamleiter', label: 'Teamleiter' },
  { key: 'setter', label: 'Setter' },
  { key: 'berater', label: 'Berater' },
  { key: 'innendienst', label: 'Innendienst' },
  { key: 'bau', label: 'Bau / Montage' },
  { key: 'buchhaltung', label: 'Buchhaltung' },
  { key: 'leadkontrolle', label: 'Leadkontrolle' },
] as const

type ActiveTab = 'quellen' | 'schnittstellen' | 'liquiditaet' | null

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: ProcessStepRow
  processId: string
  holdingId: string
  companyId: string | null
  sources: ProcessStepSourceRow[]
  interfaces: ProcessStepInterfaceRow[]
  liquidityData: ProcessStepLiquidityRow | null
  toolRegistry: ToolRegistryRow[]
  secrets: Array<{ id: string; name: string }>
  allSteps: ProcessStepRow[]
  onDeleted: (stepId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepCard({
  step,
  processId,
  holdingId,
  companyId,
  sources,
  interfaces,
  liquidityData,
  toolRegistry,
  secrets,
  allSteps,
  onDeleted,
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Editable local state
  const [name, setName] = useState(step.name)
  const [description, setDescription] = useState(step.description ?? '')
  const [mainProcess, setMainProcess] = useState(step.main_process)
  const [responsibleRoles, setResponsibleRoles] = useState<string[]>(step.responsible_roles)
  const [expectedOutput, setExpectedOutput] = useState(step.expected_output ?? '')
  const [typicalHours, setTypicalHours] = useState<number | null>(step.typical_hours)
  const [warningDays, setWarningDays] = useState<number | null>(step.warning_days)
  const [showInFlowchart, setShowInFlowchart] = useState(step.show_in_flowchart)
  const [liquidityMarker, setLiquidityMarker] = useState(step.liquidity_marker)

  // DnD
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Save step
  const saveStep = useCallback(async () => {
    await updateStepAction({
      stepId: step.id,
      processId,
      name,
      mainProcess: mainProcess ?? null,
      description,
      responsibleRoles,
      expectedOutput: expectedOutput || null,
      typicalHours,
      warningDays,
      showInFlowchart,
      liquidityMarker: liquidityMarker ?? null,
    })
  }, [
    step.id,
    processId,
    name,
    mainProcess,
    description,
    responsibleRoles,
    expectedOutput,
    typicalHours,
    warningDays,
    showInFlowchart,
    liquidityMarker,
  ])

  // Delete step
  const handleDelete = useCallback(async () => {
    if (!confirm('Schritt wirklich löschen? Alle zugehörigen Quellen, Schnittstellen und Liquiditätsdaten werden ebenfalls gelöscht.')) {
      return
    }
    setIsDeleting(true)
    const result = await deleteStepAction(step.id, processId)
    if (result.success) {
      onDeleted(step.id)
    }
    setIsDeleting(false)
  }, [step.id, processId, onDeleted])

  // Duplicate step
  const handleDuplicate = useCallback(async () => {
    await addStepAction({
      processId,
      holdingId,
      companyId,
      name: `${name} (Kopie)`,
      mainProcess: mainProcess ?? undefined,
      sortOrder: step.sort_order + 1,
    })
  }, [processId, holdingId, companyId, name, mainProcess, step.sort_order])

  // Toggle role
  const toggleRole = (roleKey: string) => {
    setResponsibleRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey],
    )
  }

  // Tab toggle
  const handleTabClick = (tab: ActiveTab) => {
    if (!isExpanded) setIsExpanded(true)
    setActiveTab((prev) => (prev === tab ? null : tab))
  }

  // Main process label
  const mainProcessLabel = MAIN_PROCESS_OPTIONS.find((o) => o.value === mainProcess)?.label

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-white shadow-sm transition-shadow ${
        isDragging ? 'border-gray-400 shadow-lg' : 'border-gray-200 hover:shadow-md'
      } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
          aria-label="Schritt verschieben"
          {...attributes}
          {...listeners}
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </button>

        {/* PROC-ID badge */}
        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600">
          {step.process_step_id}
        </span>

        {/* Name */}
        <span className="flex-1 text-sm font-medium text-gray-900 truncate">{name}</span>

        {/* Category badge */}
        {mainProcessLabel && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {mainProcessLabel}
          </span>
        )}

        {/* Roles count */}
        <span className="text-xs text-gray-500">
          {responsibleRoles.length} {responsibleRoles.length === 1 ? 'Rolle' : 'Rollen'}
        </span>

        {/* Tab buttons with count badges */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleTabClick('quellen')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              activeTab === 'quellen'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Quellen
            {sources.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/20 text-[10px]">
                {sources.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('schnittstellen')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              activeTab === 'schnittstellen'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Schnittstellen
            {interfaces.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/20 text-[10px]">
                {interfaces.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('liquiditaet')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              activeTab === 'liquiditaet'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Liquidität
            {liquidityData && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/20 text-[10px]">
                1
              </span>
            )}
          </button>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={isExpanded ? 'Zuklappen' : 'Aufklappen'}
        >
          <svg
            className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDuplicate}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Schritt duplizieren"
            title="Duplizieren"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            aria-label="Schritt löschen"
            title="Löschen"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Step fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveStep}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {/* Main process */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Hauptprozess</label>
              <select
                value={mainProcess ?? ''}
                onChange={(e) => {
                  const val = e.target.value || null
                  setMainProcess(val as ProcessStepRow['main_process'])
                }}
                onBlur={saveStep}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              >
                <option value="">Keiner</option>
                {MAIN_PROCESS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveStep}
                rows={2}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {/* Expected output */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Erwartetes Ergebnis</label>
              <input
                type="text"
                value={expectedOutput}
                onChange={(e) => setExpectedOutput(e.target.value)}
                onBlur={saveStep}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {/* Typical hours */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Typische Stunden</label>
              <input
                type="number"
                value={typicalHours ?? ''}
                onChange={(e) => setTypicalHours(e.target.value ? parseInt(e.target.value, 10) : null)}
                onBlur={saveStep}
                min={0}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {/* Warning days */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Warnung nach Tagen</label>
              <input
                type="number"
                value={warningDays ?? ''}
                onChange={(e) => setWarningDays(e.target.value ? parseInt(e.target.value, 10) : null)}
                onBlur={saveStep}
                min={0}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {/* Show in flowchart */}
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInFlowchart}
                  onChange={(e) => {
                    setShowInFlowchart(e.target.checked)
                    // Save on toggle
                    void updateStepAction({
                      stepId: step.id,
                      processId,
                      showInFlowchart: e.target.checked,
                    })
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                />
                <span className="text-gray-700">Im Flussdiagramm anzeigen</span>
              </label>
            </div>

            {/* Liquidity marker */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Liquiditätsmarker</label>
              <select
                value={liquidityMarker ?? ''}
                onChange={(e) => {
                  const val = (e.target.value || null) as ProcessStepRow['liquidity_marker']
                  setLiquidityMarker(val)
                }}
                onBlur={saveStep}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              >
                <option value="">Keiner</option>
                <option value="trigger">Trigger</option>
                <option value="event">Event</option>
              </select>
            </div>
          </div>

          {/* Responsible roles */}
          <div>
            <p className="block text-sm font-medium text-gray-600 mb-2">Verantwortliche Rollen</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <label
                  key={role.key}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors border ${
                    responsibleRoles.includes(role.key)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={responsibleRoles.includes(role.key)}
                    onChange={() => {
                      toggleRole(role.key)
                      // Defer save
                      setTimeout(saveStep, 100)
                    }}
                    className="sr-only"
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          {/* Sub-panels */}
          {activeTab === 'quellen' && (
            <SourcesPanel
              processId={processId}
              holdingId={holdingId}
              companyId={companyId}
              stepId={step.id}
              sources={sources}
            />
          )}

          {activeTab === 'schnittstellen' && (
            <InterfacesPanel
              processId={processId}
              holdingId={holdingId}
              companyId={companyId}
              stepId={step.id}
              interfaces={interfaces}
              toolRegistry={toolRegistry}
              secrets={secrets}
            />
          )}

          {activeTab === 'liquiditaet' && (
            <LiquidityPanel
              processId={processId}
              holdingId={holdingId}
              companyId={companyId}
              stepId={step.id}
              data={liquidityData}
              allSteps={allSteps}
              currentMarkerType={liquidityMarker}
            />
          )}
        </div>
      )}
    </div>
  )
}
