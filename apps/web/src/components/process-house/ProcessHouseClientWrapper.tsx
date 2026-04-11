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

  const allProcesses = [...management, ...primary, ...support]
  const selected = allProcesses.find((p) => p.id === selectedProcessId)

  return (
    <>
      <ProcessHouseView
        managementProcesses={management}
        primaryProcesses={primary}
        supportProcesses={support}
        onProcessClick={(id) => setSelectedProcessId(id)}
        onPhaseClick={(processId) => setSelectedProcessId(processId)}
      />
      {selectedProcessId && selected && (
        <ProcessKanbanPopup
          processId={selectedProcessId}
          processName={selected.menuLabel}
          processType={
            management.some((m) => m.id === selectedProcessId) ? 'M' :
            primary.some((p) => p.id === selectedProcessId) ? 'P' : 'S'
          }
          onClose={() => setSelectedProcessId(null)}
        />
      )}
    </>
  )
}
