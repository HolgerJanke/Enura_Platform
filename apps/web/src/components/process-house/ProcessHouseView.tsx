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
// Layout constants
// ---------------------------------------------------------------------------

const W = 900            // total SVG width
const H = 600            // total SVG height
const PILLAR_W = 0       // customer pillars removed
const CONTENT_X = 10
const CONTENT_W = W - 20
const ROOF_Y = 20
const ROOF_H = 120
const ARROW_Y = ROOF_Y + ROOF_H + 15
const ARROW_H = 85
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

        {/* Primary processes — rectangles */}
        {primaryProcesses.length > 0 ? (
          primaryProcesses.map((proc, i) => {
            const y = ARROW_Y + i * (ARROW_H + ARROW_GAP)
            const isHovered = hoveredId === proc.id
            return (
              <g
                key={proc.id}
                onMouseEnter={() => setHoveredId(proc.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <rect
                  x={CONTENT_X}
                  y={y}
                  width={CONTENT_W}
                  height={ARROW_H}
                  rx={8}
                  style={{ fill: COLORS.arrowFill, opacity: isHovered ? 0.85 : 1, transition: 'opacity 0.15s' }}
                  stroke={isHovered ? COLORS.hoverStroke : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                  className="cursor-pointer"
                  onClick={() => onProcessClick?.(proc.id)}
                />
                {/* Process content via foreignObject for proper text wrapping */}
                <foreignObject x={CONTENT_X + 20} y={y + 4} width={CONTENT_W - 40} height={ARROW_H - 8}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <p
                      onClick={() => onProcessClick?.(proc.id)}
                      style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: 0, textAlign: 'center', cursor: 'pointer' }}
                    >
                      P{i + 1} — {proc.menuLabel}
                    </p>
                    {proc.phases.length > 0 && (
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', margin: '4px 0 0', textAlign: 'center', lineHeight: '1.4' }}>
                        {proc.phases.map((ph, pi) => (
                          <span
                            key={ph.id}
                            onClick={() => onPhaseClick?.(proc.id, ph.id)}
                            style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline' }}
                            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none' }}
                          >
                            {pi > 0 ? ' | ' : ''}P{i + 1}.{pi + 1} {ph.name}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </foreignObject>
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
