'use client'

import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessPhaseItem {
  id: string
  name: string
  sortOrder: number
}

export interface ProcessHouseItem {
  id: string
  name: string
  menuLabel: string
  houseSortOrder: number
  status: string
  phases: ProcessPhaseItem[]
  linkedPage: string | null
}

interface ProcessHouseViewProps {
  managementProcesses: ProcessHouseItem[]
  primaryProcesses: ProcessHouseItem[]
  supportProcesses: ProcessHouseItem[]
  onProcessClick?: (processId: string) => void
  onPhaseClick?: (processId: string, phaseId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessHouseView({
  managementProcesses,
  primaryProcesses,
  supportProcesses,
  onProcessClick,
  onPhaseClick,
}: ProcessHouseViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {/* Management processes — dark bar across the top */}
      {managementProcesses.length > 0 && (
        <div className="rounded-lg p-4" style={{ background: 'var(--brand-secondary, #1A1A1A)' }}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {managementProcesses.map((proc, i) => (
              <button
                key={proc.id}
                type="button"
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`text-sm font-semibold text-white transition-opacity ${hoveredId === proc.id ? 'opacity-80 underline' : ''}`}
              >
                M{i + 1} — {proc.menuLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary processes — vertical columns side by side */}
      {primaryProcesses.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${primaryProcesses.length}, 1fr)` }}>
          {primaryProcesses.map((proc, i) => {
            const isHovered = hoveredId === proc.id
            return (
              <div
                key={proc.id}
                className="rounded-lg overflow-hidden"
                style={{ background: 'var(--brand-primary, #1A56DB)' }}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Process title header */}
                <button
                  type="button"
                  onClick={() => onProcessClick?.(proc.id)}
                  className={`w-full px-4 py-3 text-left transition-opacity ${isHovered ? 'opacity-80' : ''}`}
                  style={{ background: 'rgba(0,0,0,0.15)' }}
                >
                  <p className="text-sm font-bold text-white">P{i + 1} — {proc.menuLabel}</p>
                </button>

                {/* Phases listed vertically */}
                <div className="px-4 py-2 space-y-1">
                  {proc.phases.length > 0 ? (
                    proc.phases.map((ph, pi) => (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => onPhaseClick?.(proc.id, ph.id)}
                        className="w-full text-left flex items-start gap-2 py-1.5 rounded px-2 -mx-2 hover:bg-white/10 transition-colors group"
                      >
                        <span className="text-[11px] font-mono text-white/60 shrink-0 mt-px">
                          P{i + 1}.{pi + 1}
                        </span>
                        <span className="text-[12px] text-white/90 group-hover:text-white group-hover:underline leading-tight">
                          {ph.name}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-[11px] text-white/50 py-2">Keine Phasen</p>
                  )}
                  {/* Placeholder space for future KPIs */}
                  <div className="pt-2 border-t border-white/10 mt-2">
                    <p className="text-[10px] text-white/30 italic">KPIs</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Support processes — foundation row */}
      {supportProcesses.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${supportProcesses.length}, 1fr)` }}>
          {supportProcesses.map((proc, i) => {
            const isHovered = hoveredId === proc.id
            return (
              <button
                key={proc.id}
                type="button"
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`rounded-lg px-4 py-4 text-center transition-opacity ${isHovered ? 'opacity-80' : ''}`}
                style={{ background: 'var(--brand-accent, #F3A917)' }}
              >
                <p className="text-sm font-bold text-white">S{i + 1}</p>
                <p className="text-xs text-white/85 mt-0.5">{proc.menuLabel}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
