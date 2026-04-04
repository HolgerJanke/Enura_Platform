'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type {
  ProcessStepRow,
  ProcessStepSourceRow,
  ProcessStepInterfaceRow,
  ProcessStepLiquidityRow,
  ToolRegistryRow,
} from '@enura/types'
import { StepCard } from './StepCard'
import {
  addStepAction,
  reorderStepsAction,
} from '@/app/(holding)/admin/processes/[id]/actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepListProps {
  processId: string
  holdingId: string
  companyId: string | null
  steps: ProcessStepRow[]
  sources: ProcessStepSourceRow[]
  interfaces: ProcessStepInterfaceRow[]
  liquidity: ProcessStepLiquidityRow[]
  toolRegistry: ToolRegistryRow[]
  secrets: Array<{ id: string; name: string }>
  allSteps: ProcessStepRow[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepList({
  processId,
  holdingId,
  companyId,
  steps: initialSteps,
  sources,
  interfaces,
  liquidity,
  toolRegistry,
  secrets,
  allSteps,
}: StepListProps) {
  const [steps, setSteps] = useState<ProcessStepRow[]>(initialSteps)
  const [isAdding, setIsAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Add step
  const handleAddStep = useCallback(
    async (position: 'top' | 'bottom') => {
      setIsAdding(true)
      const sortOrder = position === 'top' ? 0 : steps.length
      const result = await addStepAction({
        processId,
        holdingId,
        companyId,
        name: 'Neuer Schritt',
        sortOrder,
      })

      if (result.success && result.data) {
        const newStep = result.data as unknown as ProcessStepRow
        if (position === 'top') {
          setSteps((prev) => [newStep, ...prev])
        } else {
          setSteps((prev) => [...prev, newStep])
        }
      }
      setIsAdding(false)
    },
    [processId, holdingId, companyId, steps.length],
  )

  // Drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = steps.findIndex((s) => s.id === active.id)
      const newIndex = steps.findIndex((s) => s.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      // Optimistic reorder
      const reordered = [...steps]
      const [moved] = reordered.splice(oldIndex, 1)
      if (!moved) return
      reordered.splice(newIndex, 0, moved)
      setSteps(reordered)

      // Persist
      const order = reordered.map((s, idx) => ({
        stepId: s.id,
        sortOrder: idx,
      }))

      await reorderStepsAction({ processId, order })
    },
    [steps, processId],
  )

  // Remove step from local state
  const handleStepDeleted = useCallback((stepId: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== stepId))
  }, [])

  return (
    <div className="space-y-4">
      {/* Add step at top */}
      <button
        type="button"
        onClick={() => handleAddStep('top')}
        disabled={isAdding}
        className="w-full rounded-md border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:opacity-50"
      >
        + Schritt hinzufuegen
      </button>

      {/* Steps */}
      {steps.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
          <p className="text-gray-500 text-sm">
            Noch keine Schritte vorhanden. Fuegen Sie den ersten Schritt hinzu.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {steps.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  processId={processId}
                  holdingId={holdingId}
                  companyId={companyId}
                  sources={sources.filter((s) => s.step_id === step.id)}
                  interfaces={interfaces.filter((i) => i.step_id === step.id)}
                  liquidityData={liquidity.find((l) => l.step_id === step.id) ?? null}
                  toolRegistry={toolRegistry}
                  secrets={secrets}
                  allSteps={allSteps}
                  onDeleted={handleStepDeleted}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add step at bottom */}
      <button
        type="button"
        onClick={() => handleAddStep('bottom')}
        disabled={isAdding}
        className="w-full rounded-md border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:opacity-50"
      >
        + Schritt hinzufuegen
      </button>
    </div>
  )
}
