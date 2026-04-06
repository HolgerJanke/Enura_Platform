'use client'

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export type LineChartProps = {
  data: Array<Record<string, unknown>>
  xKey: string
  lines: Array<{
    key: string
    label: string
    color?: string
  }>
  height?: number
  loading?: boolean
  formatX?: (value: string) => string
  formatY?: (value: number) => string
  title?: string
}

export function LineChartComponent({
  data,
  xKey,
  lines,
  height = 300,
  loading = false,
  formatX,
  formatY,
  title,
}: LineChartProps) {
  if (loading) {
    return (
      <div style={{ height }} className="animate-pulse bg-brand-surface rounded-brand" />
    )
  }

  return (
    <div role="img" aria-label={title ?? 'Line chart'}>
      {title && <p className="text-sm font-medium text-brand-text-primary mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
          />
          <Legend />
          {lines.map((line, i) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color ?? (i === 0 ? 'var(--brand-primary)' : 'var(--brand-accent)')}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
