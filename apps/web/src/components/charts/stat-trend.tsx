'use client'

import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'

export type StatTrendProps = {
  data: Array<{ value: number }>
  height?: number
  width?: number
  color?: string
  loading?: boolean
  trend?: 'up' | 'down' | 'neutral'
  label?: string
}

function getTrendColor(trend: StatTrendProps['trend']): string {
  switch (trend) {
    case 'up':
      return '#16a34a'
    case 'down':
      return '#dc2626'
    case 'neutral':
    default:
      return 'var(--brand-primary)'
  }
}

export function StatTrend({
  data,
  height = 40,
  width = 120,
  color,
  loading = false,
  trend,
  label,
}: StatTrendProps) {
  if (loading) {
    return (
      <div
        style={{ height, width }}
        className="animate-pulse bg-brand-surface rounded-brand"
      />
    )
  }

  if (data.length === 0) {
    return (
      <div
        style={{ height, width }}
        className="flex items-center justify-center text-xs text-brand-text-secondary"
        role="img"
        aria-label={label ?? 'No trend data'}
      >
        --
      </div>
    )
  }

  const strokeColor = color ?? getTrendColor(trend)

  return (
    <div
      role="img"
      aria-label={label ?? `Sparkline trend: ${trend ?? 'neutral'}`}
      style={{ width, height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
