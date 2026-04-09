'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import type {
  ProcessDefinitionRow,
  ProcessStepRow,
  ProcessStepSourceRow,
  ProcessStepInterfaceRow,
  ProcessStepLiquidityRow,
  ToolRegistryRow,
} from '@enura/types'
import { ProcessHeader } from './ProcessHeader'
import { StepList } from './StepList'
import {
  saveProcessAction,
  finaliseProcessAction,
  type ActionResult,
} from '@/app/(holding)/admin/processes/[id]/actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessBuilderData {
  definition: ProcessDefinitionRow
  steps: ProcessStepRow[]
  sources: ProcessStepSourceRow[]
  interfaces: ProcessStepInterfaceRow[]
  liquidity: ProcessStepLiquidityRow[]
  toolRegistry: ToolRegistryRow[]
  secrets: Array<{ id: string; name: string }>
}

interface StatusBadgeProps {
  status: ProcessDefinitionRow['status']
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ProcessDefinitionRow['status'], string> = {
  draft: 'Entwurf',
  finalised: 'Finalisiert',
  pending_approval: 'Genehmigung ausstehend',
  deployed: 'Deployed',
  archived: 'Archiviert',
}

const STATUS_COLORS: Record<ProcessDefinitionRow['status'], string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  finalised: 'bg-green-100 text-green-800',
  pending_approval: 'bg-blue-100 text-blue-800',
  deployed: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-gray-100 text-gray-600',
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Auto-save indicator
// ---------------------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <span
      className={`text-xs ${
        state === 'saving'
          ? 'text-gray-400'
          : state === 'saved'
            ? 'text-green-600'
            : 'text-red-600'
      }`}
    >
      {state === 'saving' && 'Speichern...'}
      {state === 'saved' && 'Gespeichert'}
      {state === 'error' && 'Fehler beim Speichern'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProcessBuilder({ data }: { data: ProcessBuilderData }) {
  const { definition, steps, sources, interfaces, liquidity, toolRegistry, secrets } = data

  // Local state for header fields
  const [name, setName] = useState(definition.name)
  const [category, setCategory] = useState(definition.category)
  const [menuLabel, setMenuLabel] = useState(definition.menu_label)
  const [menuIcon, setMenuIcon] = useState(definition.menu_icon)
  const [visibleRoles, setVisibleRoles] = useState<string[]>(definition.visible_roles)
  const [status, setStatus] = useState(definition.status)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [finaliseError, setFinaliseError] = useState<string | null>(null)

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirtyRef = useRef(false)

  // Track changes
  const markDirty = useCallback(() => {
    isDirtyRef.current = true
  }, [])

  // Auto-save function
  const doSave = useCallback(async () => {
    if (!isDirtyRef.current) return

    setSaveState('saving')
    const result: ActionResult = await saveProcessAction({
      processId: definition.id,
      name,
      category,
      menuLabel,
      menuIcon,
      visibleRoles,
    })

    if (result.success) {
      isDirtyRef.current = false
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } else {
      setSaveState('error')
    }
  }, [definition.id, name, category, menuLabel, menuIcon, visibleRoles])

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      void doSave()
    }, 30_000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [doSave])

  // Manual save
  const handleSave = useCallback(() => {
    isDirtyRef.current = true
    void doSave()
  }, [doSave])

  // Finalise
  const handleFinalise = useCallback(async () => {
    setFinaliseError(null)

    // Save first
    isDirtyRef.current = true
    await doSave()

    const result = await finaliseProcessAction(definition.id)
    if (result.success) {
      setStatus('finalised')
    } else {
      setFinaliseError(result.error ?? 'Unbekannter Fehler')
    }
  }, [definition.id, doSave])

  // Header change handlers
  const handleNameChange = useCallback(
    (val: string) => {
      setName(val)
      markDirty()
    },
    [markDirty],
  )

  const handleCategoryChange = useCallback(
    (val: ProcessDefinitionRow['category']) => {
      setCategory(val)
      markDirty()
    },
    [markDirty],
  )

  const handleMenuLabelChange = useCallback(
    (val: string) => {
      setMenuLabel(val)
      markDirty()
    },
    [markDirty],
  )

  const handleMenuIconChange = useCallback(
    (val: string) => {
      setMenuIcon(val)
      markDirty()
    },
    [markDirty],
  )

  const handleVisibleRolesChange = useCallback(
    (val: string[]) => {
      setVisibleRoles(val)
      markDirty()
    },
    [markDirty],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/processes"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Zurueck zur Prozessliste"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{name || 'Unbenannter Prozess'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={status} />
              <span className="text-xs text-gray-500">v{definition.version}</span>
              <SaveIndicator state={saveState} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {finaliseError && (
            <span className="text-sm text-red-600">{finaliseError}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Speichern
          </button>
          {status === 'draft' && (
            <button
              type="button"
              onClick={handleFinalise}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Finalisieren
            </button>
          )}
        </div>
      </div>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-4">
          <ProcessHeader
            name={name}
            category={category}
            menuLabel={menuLabel}
            menuIcon={menuIcon}
            visibleRoles={visibleRoles}
            onNameChange={handleNameChange}
            onCategoryChange={handleCategoryChange}
            onMenuLabelChange={handleMenuLabelChange}
            onMenuIconChange={handleMenuIconChange}
            onVisibleRolesChange={handleVisibleRolesChange}
          />
        </div>

        {/* Main area: step list */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <StepList
            processId={definition.id}
            holdingId={definition.holding_id}
            companyId={definition.company_id}
            steps={steps}
            sources={sources}
            interfaces={interfaces}
            liquidity={liquidity}
            toolRegistry={toolRegistry}
            secrets={secrets}
            allSteps={steps}
          />
        </div>
      </div>
    </div>
  )
}
