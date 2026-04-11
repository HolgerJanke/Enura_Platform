'use client'

import { useState } from 'react'
import { ProcessHouseView, type ProcessHouseItem } from './ProcessHouseView'
import { ProcessKanbanPopup } from './ProcessKanbanPopup'

interface Props {
  management: ProcessHouseItem[]
  primary: ProcessHouseItem[]
  support: ProcessHouseItem[]
}

export function ProcessHouseClientWrapper({ management, primary, support }: Props) {
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)

  const allProcesses = [...management, ...primary, ...support]
  const selected = allProcesses.find((p) => p.id === selectedProcessId)

  function handleProcessClick(processId: string) {
    setSelectedProcessId(processId)
    setSelectedPhaseId(null) // Show all phases
  }

  function handlePhaseClick(processId: string, phaseId: string) {
    setSelectedProcessId(processId)
    setSelectedPhaseId(phaseId) // Show only this phase
  }

  return (
    <>
      <ProcessHouseView
        managementProcesses={management}
        primaryProcesses={primary}
        supportProcesses={support}
        onProcessClick={handleProcessClick}
        onPhaseClick={handlePhaseClick}
      />
      {selectedProcessId && selected && (
        <ProcessKanbanPopup
          processId={selectedProcessId}
          processName={selected.menuLabel}
          processType={
            management.some((m) => m.id === selectedProcessId) ? 'M' :
            primary.some((p) => p.id === selectedProcessId) ? 'P' : 'S'
          }
          filterPhaseId={selectedPhaseId}
          onClose={() => { setSelectedProcessId(null); setSelectedPhaseId(null) }}
        />
      )}
    </>
  )
}
