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
// Trend arrow component
// ---------------------------------------------------------------------------

function TrendArrow({ trend, value }: { trend?: 'up' | 'down' | 'same'; value: number }) {
  if (trend === 'up') return <span className="text-green-600 font-semibold">↑{value}</span>
  if (trend === 'down') return <span className="text-red-600 font-semibold">↓{value}</span>
  return <span className="text-gray-400 font-medium">→{value}</span>
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

      {/* Primary processes — white card columns with colored headers */}
      {primaryProcesses.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${primaryProcesses.length}, 1fr)` }}>
          {primaryProcesses.map((proc, i) => {
            const totalProjects = proc.phases.reduce((s, ph) => s + (ph.inCount ?? 0) + (ph.outCount ?? 0), 0)
            const totalValue = proc.phases.reduce((s, ph) => s + (ph.portfolioValue ?? 0), 0)
            return (
            <div key={proc.id} className="rounded-lg border border-gray-200 overflow-hidden shadow-sm" style={{ background: 'color-mix(in srgb, var(--brand-primary, #1A56DB) 8%, white)' }}>
              {/* Colored header with totals */}
              <button
                type="button"
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`w-full px-4 py-2.5 text-left transition-opacity ${hoveredId === proc.id ? 'opacity-90' : ''}`}
                style={{ background: 'var(--brand-primary, #1A56DB)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">P{i + 1} — {proc.menuLabel}</p>
                  <div className="flex items-center gap-3 text-[11px] text-white/90">
                    {totalProjects > 0 && <span>{totalProjects} Projekte</span>}
                    {totalValue > 0 && <span className="font-mono">{currency} {totalValue.toLocaleString('de-CH', { maximumFractionDigits: 0 })}</span>}
                  </div>
                </div>
              </button>

              {/* Phases on white background */}
              <div className="divide-y divide-gray-100">
                {proc.phases.length > 0 ? (
                  proc.phases.map((ph, pi) => (
                    <button
                      key={ph.id}
                      type="button"
                      onClick={() => onPhaseClick?.(proc.id, ph.id)}
                      className="w-full text-left px-4 py-2 hover:bg-white/60 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400 shrink-0">
                          P{i + 1}.{pi + 1}
                        </span>
                        <span className="text-[13px] text-gray-900 font-medium group-hover:text-blue-700 group-hover:underline leading-tight">
                          {ph.name}
                        </span>
                        {/* KPIs inline */}
                        {(ph.inCount != null || ph.outCount != null) && (
                          <span className="flex items-center gap-2 ml-auto text-[11px] shrink-0">
                            <span className="text-gray-400">In:</span><TrendArrow trend={ph.inTrend} value={ph.inCount ?? 0} />
                            <span className="text-gray-400">Out:</span><TrendArrow trend={ph.outTrend} value={ph.outCount ?? 0} />
                            {(ph.portfolioValue ?? 0) > 0 && (
                              <span className="text-gray-500 font-mono">
                                {currency} {(ph.portfolioValue ?? 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 px-4 py-3">Keine Phasen</p>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Support processes — white card columns with accent headers */}
      {supportProcesses.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${supportProcesses.length}, 1fr)` }}>
          {supportProcesses.map((proc, i) => (
            <div key={proc.id} className="rounded-lg border border-gray-200 overflow-hidden shadow-sm" style={{ background: 'color-mix(in srgb, var(--brand-accent, #F3A917) 8%, white)' }}>
              {/* Colored header */}
              <button
                type="button"
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`w-full px-4 py-2.5 text-left transition-opacity ${hoveredId === proc.id ? 'opacity-90' : ''}`}
                style={{ background: 'var(--brand-accent, #F3A917)' }}
              >
                <p className="text-sm font-bold text-white">S{i + 1} — {proc.menuLabel}</p>
              </button>

              {/* Steps on white background */}
              {proc.phases.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {proc.phases.map((ph, pi) => (
                    <button
                      key={ph.id}
                      type="button"
                      onClick={() => onPhaseClick?.(proc.id, ph.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400 shrink-0">
                          S{i + 1}.{pi + 1}
                        </span>
                        <span className="text-[13px] text-gray-900 font-medium group-hover:text-blue-700 group-hover:underline leading-tight">
                          {ph.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
