'use client'

import { useState, useCallback } from 'react'
import type { EnrichedStep } from '@/app/(dashboard)/processes/[id]/page'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_WIDTH = 300
const CARD_HEIGHT_BASE = 80
const CARD_HEIGHT_LIQUIDITY = 104
const CARD_GAP = 48
const PADDING_X = 40
const PADDING_Y = 32

// Main process color map
const MAIN_PROCESS_FILL: Record<string, string> = {
  vertrieb: 'var(--brand-primary, #1A56DB)',
  planung: '#F59E0B',
  abwicklung: '#14B8A6',
  service: '#A855F7',
}

const MAIN_PROCESS_FILL_LIGHT: Record<string, string> = {
  vertrieb: 'rgba(26, 86, 219, 0.08)',
  planung: 'rgba(245, 158, 11, 0.08)',
  abwicklung: 'rgba(20, 184, 166, 0.08)',
  service: 'rgba(168, 85, 247, 0.08)',
}

const MAIN_PROCESS_STROKE: Record<string, string> = {
  vertrieb: 'rgba(26, 86, 219, 0.3)',
  planung: 'rgba(245, 158, 11, 0.3)',
  abwicklung: 'rgba(20, 184, 166, 0.3)',
  service: 'rgba(168, 85, 247, 0.3)',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FlowchartViewProps {
  steps: EnrichedStep[]
  onStepClick?: (stepId: string) => void
}

export function FlowchartView({ steps, onStepClick }: FlowchartViewProps) {
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null)

  // Only show steps where show_in_flowchart is true
  const visibleSteps = steps
    .filter((s) => s.show_in_flowchart)
    .sort((a, b) => a.sort_order - b.sort_order)

  const handleStepClick = useCallback(
    (stepId: string) => {
      if (onStepClick) onStepClick(stepId)
    },
    [onStepClick],
  )

  if (visibleSteps.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">
          Keine Schritte für die Flowchart-Ansicht verfügbar.
        </p>
      </div>
    )
  }

  // Calculate positions
  const cardX = PADDING_X
  let currentY = PADDING_Y

  const cardPositions: Array<{
    step: EnrichedStep
    x: number
    y: number
    height: number
    isLiquidity: boolean
  }> = []

  for (const step of visibleSteps) {
    const isLiquidity = step.liquidity_marker !== null
    const height = isLiquidity ? CARD_HEIGHT_LIQUIDITY : CARD_HEIGHT_BASE
    cardPositions.push({
      step,
      x: cardX,
      y: currentY,
      height,
      isLiquidity,
    })
    currentY += height + CARD_GAP
  }

  const svgWidth = CARD_WIDTH + PADDING_X * 2
  const svgHeight = currentY + PADDING_Y

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Prozess-Flowchart"
      >
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
          </marker>
        </defs>

        {/* Connecting arrows */}
        {cardPositions.map((pos, idx) => {
          if (idx === cardPositions.length - 1) return null
          const fromY = pos.y + pos.height
          const toY = cardPositions[idx + 1]?.y ?? fromY
          const centerX = pos.x + CARD_WIDTH / 2

          return (
            <line
              key={`arrow-${idx}`}
              x1={centerX}
              y1={fromY}
              x2={centerX}
              y2={toY}
              stroke="#9CA3AF"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          )
        })}

        {/* Step cards */}
        {cardPositions.map((pos) => {
          const { step, x, y, height, isLiquidity } = pos
          const mp = step.main_process ?? 'sonstige'
          const isHovered = hoveredStepId === step.id

          const accentColor = MAIN_PROCESS_FILL[mp] ?? '#9CA3AF'
          const fillColor = isLiquidity
            ? '#FFFBEB'
            : MAIN_PROCESS_FILL_LIGHT[mp] ?? '#F9FAFB'
          const strokeColor = isLiquidity
            ? '#FCD34D'
            : MAIN_PROCESS_STROKE[mp] ?? '#E5E7EB'
          const textColor = '#111827'

          return (
            <g
              key={step.id}
              className="cursor-pointer"
              onClick={() => handleStepClick(step.id)}
              onMouseEnter={() => setHoveredStepId(step.id)}
              onMouseLeave={() => setHoveredStepId(null)}
              role="button"
              tabIndex={0}
              aria-label={`Schritt ${step.process_step_id}: ${step.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleStepClick(step.id)
                }
              }}
            >
              {/* Hover highlight */}
              {isHovered && (
                <rect
                  x={x - 3}
                  y={y - 3}
                  width={CARD_WIDTH + 6}
                  height={height + 6}
                  rx={11}
                  ry={11}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="2"
                  opacity={0.5}
                />
              )}

              {/* Card background */}
              <rect
                x={x}
                y={y}
                width={CARD_WIDTH}
                height={height}
                rx={8}
                ry={8}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeDasharray={isLiquidity ? '6 3' : 'none'}
              />

              {/* Color accent bar on left */}
              <rect
                x={x}
                y={y}
                width={4}
                height={height}
                rx={2}
                fill={accentColor}
              />

              {/* Step ID badge */}
              <rect
                x={x + 14}
                y={y + 12}
                width={Math.max(step.process_step_id.length * 7.5 + 12, 50)}
                height={20}
                rx={4}
                fill={isHovered ? accentColor : '#E5E7EB'}
                opacity={isHovered ? 0.15 : 1}
              />
              <text
                x={x + 20}
                y={y + 26}
                fontSize="11"
                fontFamily="monospace"
                fill={isHovered ? accentColor : '#374151'}
              >
                {step.process_step_id}
              </text>

              {/* Main process label (small) */}
              {step.main_process && (
                <text
                  x={x + CARD_WIDTH - 12}
                  y={y + 24}
                  fontSize="9"
                  textAnchor="end"
                  fill={accentColor}
                  fontWeight="600"
                  style={{textTransform: "uppercase"}}
                >
                  {step.main_process.toUpperCase()}
                </text>
              )}

              {/* Step name */}
              <text
                x={x + 14}
                y={y + 52}
                fontSize="13"
                fontWeight="600"
                fill={textColor}
              >
                {step.name.length > 38
                  ? `${step.name.slice(0, 35)}...`
                  : step.name}
              </text>

              {/* Source count hint */}
              {step.sources.length > 0 && (
                <text
                  x={x + 14}
                  y={y + 68}
                  fontSize="10"
                  fill="#9CA3AF"
                >
                  {step.sources.length} {step.sources.length === 1 ? 'Quelle' : 'Quellen'}
                  {step.interfaces.length > 0
                    ? ` | ${step.interfaces.length} ${step.interfaces.length === 1 ? 'Schnittstelle' : 'Schnittstellen'}`
                    : ''}
                </text>
              )}

              {/* Liquidity annotation */}
              {isLiquidity && step.liquidity && (
                <g>
                  {/* CHF icon circle */}
                  <circle
                    cx={x + CARD_WIDTH - 36}
                    cy={y + 52}
                    r={14}
                    fill={step.liquidity.direction === 'income' ? '#D1FAE5' : '#FEE2E2'}
                    stroke={step.liquidity.direction === 'income' ? '#6EE7B7' : '#FCA5A5'}
                    strokeWidth="1"
                  />
                  <text
                    x={x + CARD_WIDTH - 36}
                    y={y + 56}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                    fill={step.liquidity.direction === 'income' ? '#065F46' : '#991B1B'}
                  >
                    CHF
                  </text>

                  {/* Amount */}
                  {step.liquidity.plan_amount !== null && (
                    <text
                      x={x + 14}
                      y={y + 88}
                      fontSize="11"
                      fontWeight="600"
                      fill={step.liquidity.direction === 'income' ? '#065F46' : '#991B1B'}
                    >
                      {step.liquidity.direction === 'income' ? '+' : '-'}
                      {formatAmount(step.liquidity.plan_amount)}{' '}
                      {step.liquidity.plan_currency}
                    </text>
                  )}
                </g>
              )}

              {/* Tooltip on hover */}
              {isHovered && step.description && (
                <g>
                  <rect
                    x={x + CARD_WIDTH + 12}
                    y={y}
                    width={220}
                    height={60}
                    rx={6}
                    fill="#1F2937"
                    opacity={0.95}
                  />
                  <text
                    x={x + CARD_WIDTH + 22}
                    y={y + 20}
                    fontSize="11"
                    fill="#FFFFFF"
                    fontWeight="500"
                  >
                    {step.description.length > 60
                      ? `${step.description.slice(0, 57)}...`
                      : step.description}
                  </text>
                  {step.responsible_roles.length > 0 && (
                    <text
                      x={x + CARD_WIDTH + 22}
                      y={y + 40}
                      fontSize="10"
                      fill="#9CA3AF"
                    >
                      Rollen: {step.responsible_roles.join(', ')}
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
