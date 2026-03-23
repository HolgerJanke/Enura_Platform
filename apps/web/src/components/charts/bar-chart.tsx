'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'

export type BarChartProps = {
  data: Array<Record<string, unknown>>
  xKey: string
  bars: Array<{
    key: string
    label: string
    color?: string
    stackId?: string
  }>
  height?: number
  loading?: boolean
  formatX?: (value: string) => string
  formatY?: (value: number) => string
  title?: string
  layout?: 'vertical' | 'horizontal'
  showLegend?: boolean
  barColors?: string[]
}

const DEFAULT_COLORS = [
  'var(--brand-primary)',
  'var(--brand-accent)',
  'var(--brand-secondary)',
]

export function BarChartComponent({
  data,
  xKey,
  bars,
  height = 300,
  loading = false,
  formatX,
  formatY,
  title,
  layout = 'horizontal',
  showLegend = true,
  barColors,
}: BarChartProps) {
  if (loading) {
    return (
      <div style={{ height }} className="animate-pulse bg-brand-surface rounded-brand" />
    )
  }

  const isVertical = layout === 'vertical'

  return (
    <div role="img" aria-label={title ?? 'Bar chart'}>
      {title && <p className="text-sm font-medium text-brand-text-primary mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={isVertical ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 20, bottom: 5, left: isVertical ? 80 : 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-text-secondary)" opacity={0.2} />
          {isVertical ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
                tickFormatter={formatY}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
                tickFormatter={formatX}
                width={75}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
                tickFormatter={formatX}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--brand-text-secondary)' }}
                tickFormatter={formatY}
              />
            </>
          )}
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
          {bars.map((bar, i) => {
            const fillColor = bar.color ?? barColors?.[i] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]

            return (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={fillColor}
                stackId={bar.stackId}
                radius={[4, 4, 0, 0]}
              >
                {barColors && bars.length === 1
                  ? data.map((_, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={barColors[idx % barColors.length]}
                      />
                    ))
                  : null}
              </Bar>
            )
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
