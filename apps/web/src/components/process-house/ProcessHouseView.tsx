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
}

interface ProcessHouseViewProps {
  managementProcesses: ProcessHouseItem[]
  primaryProcesses: ProcessHouseItem[]
  supportProcesses: ProcessHouseItem[]
  onProcessClick?: (processId: string) => void
  onPhaseClick?: (processId: string, phaseId: string) => void
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const W = 900            // total SVG width
const H = 600            // total SVG height
const PILLAR_W = 50      // customer pillar width
const CONTENT_X = PILLAR_W + 10
const CONTENT_W = W - 2 * PILLAR_W - 20
const ROOF_Y = 20
const ROOF_H = 120
const ARROW_Y = ROOF_Y + ROOF_H + 15
const ARROW_H = 70
const ARROW_GAP = 8
const FOUND_Y_OFFSET = 20
const FOUND_H = 90
const FOUND_GAP = 15

// Colors — uses brand CSS vars so each company gets its own look
// Fallbacks are provided for SSR / non-branded contexts
const COLORS = {
  roofFill: 'var(--brand-secondary, #1A1A1A)',
  roofText: '#FFFFFF',
  arrowFill: 'var(--brand-primary, #1A56DB)',
  arrowText: '#FFFFFF',
  foundFill: 'var(--brand-accent, #F3A917)',
  foundText: '#FFFFFF',
  pillarFill: 'var(--brand-text-secondary, #6B7280)',
  pillarText: '#FFFFFF',
  hoverStroke: 'var(--brand-text-primary, #111827)',
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

  const pCount = Math.max(primaryProcesses.length, 1)
  const totalArrowH = pCount * ARROW_H + (pCount - 1) * ARROW_GAP
  const foundY = ARROW_Y + totalArrowH + FOUND_Y_OFFSET
  const sCount = Math.max(supportProcesses.length, 1)
  const foundW = (CONTENT_W - (sCount - 1) * FOUND_GAP) / sCount
  const hasSupport = supportProcesses.length > 0
  const contentBottomY = hasSupport ? foundY + FOUND_H : ARROW_Y + totalArrowH
  const pillarTopY = ROOF_Y + ROOF_H - 10
  const pillarH = contentBottomY - pillarTopY + 10
  const totalH = contentBottomY + 40

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${totalH}`}
        className="w-full max-w-[900px] mx-auto"
        role="img"
        aria-label="Prozesshaus-Visualisierung"
      >
        {/* Left Customer Pillar */}
        <rect x={0} y={pillarTopY} width={PILLAR_W} height={pillarH} rx={4} style={{ fill: COLORS.pillarFill }} />
        <text x={PILLAR_W / 2} y={pillarTopY + pillarH / 2} textAnchor="middle" dominantBaseline="central" fill={COLORS.pillarText} fontSize={14} fontWeight={700} transform={`rotate(-90, ${PILLAR_W / 2}, ${pillarTopY + pillarH / 2})`}>
          Kunde
        </text>

        {/* Right Customer Pillar */}
        <rect x={W - PILLAR_W} y={pillarTopY} width={PILLAR_W} height={pillarH} rx={4} style={{ fill: COLORS.pillarFill }} />
        <text x={W - PILLAR_W / 2} y={pillarTopY + pillarH / 2} textAnchor="middle" dominantBaseline="central" fill={COLORS.pillarText} fontSize={14} fontWeight={700} transform={`rotate(90, ${W - PILLAR_W / 2}, ${pillarTopY + pillarH / 2})`}>
          Kunde
        </text>

        {/* Roof — Management processes (triangle) */}
        <polygon
          points={`${W / 2},${ROOF_Y} ${CONTENT_X},${ROOF_Y + ROOF_H} ${CONTENT_X + CONTENT_W},${ROOF_Y + ROOF_H}`}
          style={{ fill: COLORS.roofFill }}
          rx={6}
        />
        {managementProcesses.length > 0 ? (
          managementProcesses.map((proc, i) => {
            const yPos = ROOF_Y + 35 + i * 28
            const isHovered = hoveredId === proc.id
            return (
              <g
                key={proc.id}
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer"
              >
                <text
                  x={W / 2}
                  y={yPos}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={COLORS.roofText}
                  fontSize={isHovered ? 15 : 13}
                  fontWeight={isHovered ? 800 : 600}
                  style={{ transition: 'font-size 0.15s' }}
                >
                  M{i + 1} — {proc.menuLabel}
                </text>
              </g>
            )
          })
        ) : (
          <text x={W / 2} y={ROOF_Y + 60} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={12}>
            Management-Prozesse hier zuweisen
          </text>
        )}

        {/* Primary processes — horizontal arrows */}
        {primaryProcesses.length > 0 ? (
          primaryProcesses.map((proc, i) => {
            const y = ARROW_Y + i * (ARROW_H + ARROW_GAP)
            const isHovered = hoveredId === proc.id
            const arrowPoints = `${CONTENT_X},${y + ARROW_H / 2} ${CONTENT_X + 15},${y} ${CONTENT_X + CONTENT_W - 15},${y} ${CONTENT_X + CONTENT_W},${y + ARROW_H / 2} ${CONTENT_X + CONTENT_W - 15},${y + ARROW_H} ${CONTENT_X + 15},${y + ARROW_H}`
            return (
              <g
                key={proc.id}
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer"
              >
                <polygon
                  points={arrowPoints}
                  style={{ fill: COLORS.arrowFill, opacity: isHovered ? 0.85 : 1, transition: 'opacity 0.15s' }}
                  stroke={isHovered ? COLORS.hoverStroke : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                />
                {/* Process title */}
                <text
                  x={CONTENT_X + CONTENT_W / 2}
                  y={y + (proc.phases.length > 0 ? 22 : ARROW_H / 2)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={COLORS.arrowText}
                  fontSize={14}
                  fontWeight={700}
                >
                  P{i + 1} — {proc.menuLabel}
                </text>
                {/* Phase labels */}
                {proc.phases.length > 0 && (
                  <text
                    x={CONTENT_X + CONTENT_W / 2}
                    y={y + 45}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.85)"
                    fontSize={10}
                  >
                    {proc.phases.map((ph, pi) => {
                      const label = `P${i + 1}.${pi + 1} ${ph.name}`
                      return (
                        <tspan
                          key={ph.id}
                          onClick={(e) => { e.stopPropagation(); onPhaseClick?.(proc.id, ph.id) }}
                          className="cursor-pointer hover:underline"
                          style={{ textDecoration: 'none' }}
                        >
                          {pi > 0 ? '  |  ' : ''}{label}
                        </tspan>
                      )
                    })}
                  </text>
                )}
              </g>
            )
          })
        ) : (
          <rect x={CONTENT_X} y={ARROW_Y} width={CONTENT_W} height={ARROW_H} rx={6} fill="#E5E7EB" />
        )}

        {/* Support processes — foundation blocks */}
        {supportProcesses.length > 0 ? (
          supportProcesses.map((proc, i) => {
            const x = CONTENT_X + i * (foundW + FOUND_GAP)
            const isHovered = hoveredId === proc.id
            // Pentagon (house shape): rect + triangle roof
            const houseRoofH = 20
            const bodyY = foundY + houseRoofH
            const bodyH = FOUND_H - houseRoofH
            return (
              <g
                key={proc.id}
                onClick={() => onProcessClick?.(proc.id)}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer"
              >
                {/* Small roof */}
                <polygon
                  points={`${x + foundW / 2},${foundY} ${x},${bodyY} ${x + foundW},${bodyY}`}
                  style={{ fill: COLORS.foundFill, opacity: isHovered ? 0.85 : 1, transition: 'opacity 0.15s' }}
                />
                {/* Body */}
                <rect
                  x={x}
                  y={bodyY}
                  width={foundW}
                  height={bodyH}
                  style={{ fill: COLORS.foundFill, opacity: isHovered ? 0.85 : 1, transition: 'opacity 0.15s' }}
                  stroke={isHovered ? COLORS.hoverStroke : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                />
                {/* Label */}
                <text
                  x={x + foundW / 2}
                  y={bodyY + 15}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={COLORS.foundText}
                  fontSize={13}
                  fontWeight={700}
                >
                  S{i + 1}
                </text>
                <text
                  x={x + foundW / 2}
                  y={bodyY + 38}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={COLORS.foundText}
                  fontSize={11}
                  fontWeight={400}
                >
                  {proc.menuLabel.length > 15 ? proc.menuLabel.slice(0, 14) + '…' : proc.menuLabel}
                </text>
              </g>
            )
          })
        ) : (
          <rect x={CONTENT_X} y={foundY} width={CONTENT_W} height={FOUND_H} rx={6} fill="#E5E7EB" />
        )}

        {/* Title */}
        <text x={W / 2} y={totalH - 10} textAnchor="middle" fill="#9CA3AF" fontSize={11}>
          Prozesshaus — Klicken für Details
        </text>
      </svg>
    </div>
  )
}
