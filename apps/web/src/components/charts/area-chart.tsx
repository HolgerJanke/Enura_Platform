'use client'

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export type AreaChartProps = {
  data: Array<Record<string, unknown>>
  xKey: string
  areas: Array<{
    key: string
    label: string
    color?: string
    fillOpacity?: number
    stackId?: string
  }>
  height?: number
  loading?: boolean
  formatX?: (value: string) => string
  formatY?: (value: number) => string
  title?: string
  showLegend?: boolean
}

export function AreaChartComponent({
  data,
  xKey,
  areas,
  height = 300,
  loading = false,
  formatX,
  formatY,
  title,
  showLegend = true,
}: AreaChartProps) {
  if (loading) {
    return (
      <div style={{ height }} className="animate-pulse bg-brand-surface rounded-brand" />
    )
  }

  const gradientId = (key: string) => `gradient-${key}`

  return (
    <div role="img" aria-label={title ?? 'Area chart'}>
      {title && <p className="text-sm font-medium text-brand-text-primary mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            {areas.map((area, i) => {
              const color = area.color ?? (i === 0 ? 'var(--brand-primary)' : 'var(--brand-accent)')
              return (
                <linearGradient
                  key={area.key}
                  id={gradientId(area.key)}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              )
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-text-secondary)" opacity={0.2} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
            tickFormatter={formatX}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
            tickFormatter={formatY}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--brand-surface)',
              border: '1px solid var(--brand-text-secondary)',
              borderRadius: 'var(--brand-radius)',
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              new Intl.NumberFormat('de-CH').format(value),
              name,
            ]}
          />
          {showLegend && <Legend />}
          {areas.map((area, i) => {
            const color = area.color ?? (i === 0 ? 'var(--brand-primary)' : 'var(--brand-accent)')
            return (
              <Area
                key={area.key}
                type="monotone"
                dataKey={area.key}
                name={area.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId(area.key)})`}
                fillOpacity={area.fillOpacity ?? 1}
                stackId={area.stackId}
              />
            )
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  )
}
