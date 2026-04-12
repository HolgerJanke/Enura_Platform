'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProcessHouseView, type ProcessHouseItem } from './ProcessHouseView'
import { ProcessKanbanPopup } from './ProcessKanbanPopup'

interface Props {
  management: ProcessHouseItem[]
  primary: ProcessHouseItem[]
  support: ProcessHouseItem[]
  openProcess?: string
  openPhase?: string
}

export function ProcessHouseClientWrapper({ management, primary, support, openProcess, openPhase }: Props) {
  const router = useRouter()
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(openProcess ?? null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(openPhase ?? null)

  const allProcesses = [...management, ...primary, ...support]
  const selected = allProcesses.find((p) => p.id === selectedProcessId)

  function handleProcessClick(processId: string) {
    const process = allProcesses.find((p) => p.id === processId)
    if (process?.linkedPage) {
      router.push(process.linkedPage)
      return
    }
    setSelectedProcessId(processId)
    setSelectedPhaseId(null) // Show all phases
  }

  function handlePhaseClick(processId: string, phaseId: string) {
    const process = allProcesses.find((p) => p.id === processId)
    if (process?.linkedPage) {
      router.push(process.linkedPage)
      return
    }
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
