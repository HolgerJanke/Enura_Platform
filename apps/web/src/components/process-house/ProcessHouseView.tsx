'use client'

import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessPhaseItem {
  id: string
  name: string
  sortOrder: number
  link: string | null
  inCount?: number
  outCount?: number
  portfolioValue?: number
  inTrend?: 'up' | 'down' | 'same'
  outTrend?: 'up' | 'down' | 'same'
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
  currency?: string
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
  currency = 'CHF',
  onProcessClick,
  onPhaseClick,
}: ProcessHouseViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {/* Roof — Triangle with M-processes */}
      {managementProcesses.length > 0 && (
        <div className="relative">
          <svg viewBox="0 0 800 90" className="w-full" preserveAspectRatio="none">
            <polygon
              points="400,0 0,90 800,90"
              style={{ fill: 'var(--brand-secondary, #1A1A1A)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-3 gap-0.5">
            {managementProcesses.map((proc, i) => (
              <button
                key={proc.id}
                type="button"
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`text-xs font-semibold text-white transition-opacity ${hoveredId === proc.id ? 'opacity-80 underline' : ''}`}
              >
                M{i + 1} — {proc.menuLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary processes — vertical columns (sandwich middle) */}
      {primaryProcesses.length > 0 && (
        <div className="grid gap-0 rounded-lg overflow-hidden" style={{ gridTemplateColumns: `repeat(${primaryProcesses.length}, 1fr)` }}>
          {primaryProcesses.map((proc, i) => {
            const isHovered = hoveredId === proc.id
            return (
              <div
                key={proc.id}
                className={`overflow-hidden ${i > 0 ? 'border-l border-white/20' : ''}`}
                style={{ background: 'var(--brand-primary, #1A56DB)' }}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Process title header */}
                <button
                  type="button"
                  onClick={() => onProcessClick?.(proc.id)}
                  className={`w-full px-3 py-2.5 text-left transition-opacity ${isHovered ? 'opacity-80' : ''}`}
                  style={{ background: 'rgba(0,0,0,0.15)' }}
                >
                  <p className="text-xs font-bold text-white">P{i + 1} — {proc.menuLabel}</p>
                </button>

                {/* Phases with KPIs */}
                <div className="px-3 py-2 space-y-1">
                  {proc.phases.length > 0 ? (
                    proc.phases.map((ph, pi) => (
                      <div key={ph.id} className="rounded px-1.5 -mx-1.5 hover:bg-white/10 transition-colors">
                        <button
                          type="button"
                          onClick={() => onPhaseClick?.(proc.id, ph.id)}
                          className="w-full text-left flex items-start gap-1.5 py-1 group"
                        >
                          <span className="text-[10px] font-mono text-white/50 shrink-0 mt-px">
                            P{i + 1}.{pi + 1}
                          </span>
                          <span className="text-[11px] text-white/85 group-hover:text-white group-hover:underline leading-tight">
                            {ph.name}
                          </span>
                        </button>
                        {/* Phase KPIs: In/Out with trend arrows + Portfolio Value */}
                        {(ph.inCount != null || ph.outCount != null) && (
                          <div className="flex items-center gap-2 pl-6 pb-1 text-[9px]">
                            <span className="text-white/50">
                              In: {ph.inTrend === 'up' ? <span className="text-green-300">↑</span> : ph.inTrend === 'down' ? <span className="text-red-300">↓</span> : <span className="text-white/30">→</span>}
                              {' '}<span className="text-white/80 font-medium">{ph.inCount ?? 0}</span>
                            </span>
                            <span className="text-white/50">
                              Out: {ph.outTrend === 'up' ? <span className="text-green-300">↑</span> : ph.outTrend === 'down' ? <span className="text-red-300">↓</span> : <span className="text-white/30">→</span>}
                              {' '}<span className="text-white/80 font-medium">{ph.outCount ?? 0}</span>
                            </span>
                            {(ph.portfolioValue ?? 0) > 0 && (
                              <span className="text-white/50">
                                | <span className="text-white/80 font-mono font-medium">
                                  {currency} {(ph.portfolioValue ?? 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-white/40 py-1">Keine Phasen</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Support processes — foundation columns with phases */}
      {supportProcesses.length > 0 && (
        <div className="grid gap-0 rounded-lg overflow-hidden" style={{ gridTemplateColumns: `repeat(${supportProcesses.length}, 1fr)` }}>
          {supportProcesses.map((proc, i) => {
            const isHovered = hoveredId === proc.id
            return (
              <div
                key={proc.id}
                className={`overflow-hidden ${i > 0 ? 'border-l border-white/20' : ''}`}
                style={{ background: 'var(--brand-accent, #F3A917)' }}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => onProcessClick?.(proc.id)}
                  className={`w-full px-3 py-2.5 text-left transition-opacity ${isHovered ? 'opacity-80' : ''}`}
                  style={{ background: 'rgba(0,0,0,0.12)' }}
                >
                  <p className="text-xs font-bold text-white">S{i + 1} — {proc.menuLabel}</p>
                </button>
                {/* Phases */}
                {proc.phases.length > 0 && (
                  <div className="px-3 py-2 space-y-0.5">
                    {proc.phases.map((ph, pi) => (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => onPhaseClick?.(proc.id, ph.id)}
                        className="w-full text-left flex items-start gap-1.5 py-1 rounded px-1.5 -mx-1.5 hover:bg-white/10 transition-colors group"
                      >
                        <span className="text-[10px] font-mono text-white/50 shrink-0 mt-px">
                          S{i + 1}.{pi + 1}
                        </span>
                        <span className="text-[11px] text-white/85 group-hover:text-white group-hover:underline leading-tight">
                          {ph.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
