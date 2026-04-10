'use client'

import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessHouseItem {
  id: string
  name: string
  menuLabel: string
  houseSortOrder: number
  status: string
}

interface ProcessHouseViewProps {
  managementProcesses: ProcessHouseItem[]
  primaryProcesses: ProcessHouseItem[]
  supportProcesses: ProcessHouseItem[]
  onProcessClick?: (processId: string) => void
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
const ARROW_H = 50
const ARROW_GAP = 8
const FOUND_Y_OFFSET = 20
const FOUND_H = 90
const FOUND_GAP = 15

// Colors
const COLORS = {
  roofFill: '#0D9488',       // teal-600
  roofText: '#FFFFFF',
  arrowFill: '#16A34A',      // green-600
  arrowText: '#FFFFFF',
  foundFill: '#0EA5E9',      // sky-500
  foundText: '#FFFFFF',
  pillarFill: '#F59E0B',     // amber-500
  pillarText: '#FFFFFF',
  hoverStroke: '#1E293B',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessHouseView({
  managementProcesses,
  primaryProcesses,
  supportProcesses,
  onProcessClick,
}: ProcessHouseViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const pCount = Math.max(primaryProcesses.length, 1)
  const totalArrowH = pCount * ARROW_H + (pCount - 1) * ARROW_GAP
  const foundY = ARROW_Y + totalArrowH + FOUND_Y_OFFSET
  const sCount = Math.max(supportProcesses.length, 1)
  const foundW = (CONTENT_W - (sCount - 1) * FOUND_GAP) / sCount
  const totalH = Math.max(H, foundY + FOUND_H + 40)

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${totalH}`}
        className="w-full max-w-[900px] mx-auto"
        role="img"
        aria-label="Prozesshaus-Visualisierung"
      >
        {/* Left Customer Pillar */}
        <rect x={0} y={ROOF_Y + ROOF_H - 10} width={PILLAR_W} height={totalH - ROOF_Y - ROOF_H - 30} rx={4} fill={COLORS.pillarFill} />
        <text x={PILLAR_W / 2} y={ROOF_Y + ROOF_H + (totalH - ROOF_Y - ROOF_H - 30) / 2} textAnchor="middle" dominantBaseline="central" fill={COLORS.pillarText} fontSize={14} fontWeight={700} transform={`rotate(-90, ${PILLAR_W / 2}, ${ROOF_Y + ROOF_H + (totalH - ROOF_Y - ROOF_H - 30) / 2})`}>
          Kunde
        </text>

        {/* Right Customer Pillar */}
        <rect x={W - PILLAR_W} y={ROOF_Y + ROOF_H - 10} width={PILLAR_W} height={totalH - ROOF_Y - ROOF_H - 30} rx={4} fill={COLORS.pillarFill} />
        <text x={W - PILLAR_W / 2} y={ROOF_Y + ROOF_H + (totalH - ROOF_Y - ROOF_H - 30) / 2} textAnchor="middle" dominantBaseline="central" fill={COLORS.pillarText} fontSize={14} fontWeight={700} transform={`rotate(90, ${W - PILLAR_W / 2}, ${ROOF_Y + ROOF_H + (totalH - ROOF_Y - ROOF_H - 30) / 2})`}>
          Kunde
        </text>

        {/* Roof — Management processes (triangle) */}
        <polygon
          points={`${W / 2},${ROOF_Y} ${CONTENT_X},${ROOF_Y + ROOF_H} ${CONTENT_X + CONTENT_W},${ROOF_Y + ROOF_H}`}
          fill={COLORS.roofFill}
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
                  fill={isHovered ? '#15803D' : COLORS.arrowFill}
                  stroke={isHovered ? COLORS.hoverStroke : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                  style={{ transition: 'fill 0.15s' }}
                />
                <text
                  x={CONTENT_X + CONTENT_W / 2}
                  y={y + ARROW_H / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={COLORS.arrowText}
                  fontSize={14}
                  fontWeight={700}
                >
                  P{i + 1} — {proc.menuLabel}
                </text>
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
                  fill={isHovered ? '#0284C7' : COLORS.foundFill}
                  style={{ transition: 'fill 0.15s' }}
                />
                {/* Body */}
                <rect
                  x={x}
                  y={bodyY}
                  width={foundW}
                  height={bodyH}
                  fill={isHovered ? '#0284C7' : COLORS.foundFill}
                  stroke={isHovered ? COLORS.hoverStroke : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                  style={{ transition: 'fill 0.15s' }}
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
