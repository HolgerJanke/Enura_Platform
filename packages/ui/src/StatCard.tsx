import React from 'react'

import { Icon } from './Icon'

export interface StatCardTrend {
  direction: 'up' | 'down' | 'flat'
  percent: number
}

export interface StatCardProps {
  label: string
  value: string | number
  trend?: StatCardTrend
  period?: string
  className?: string
  style?: React.CSSProperties
}

const trendColors: Record<StatCardTrend['direction'], string> = {
  up: '#16A34A',
  down: '#DC2626',
  flat: '#6B7280',
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, period, className, style }) => {
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--brand-surface)',
    borderRadius: 'var(--brand-radius, 8px)',
    border: '1px solid color-mix(in srgb, var(--brand-text-secondary) 20%, transparent)',
    padding: '20px',
    fontFamily: 'var(--brand-font, inherit)',
    ...style,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--brand-text-secondary)',
    lineHeight: '18px',
    margin: 0,
  }

  const valueStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--brand-text-primary)',
    lineHeight: '36px',
    margin: '4px 0 0 0',
  }

  const trendContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '8px',
  }

  const periodStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--brand-text-secondary)',
    marginLeft: '6px',
  }

  return (
    <div className={className} style={cardStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value}</p>
      {trend ? (
        <div style={trendContainerStyle}>
          <Icon
            name={trend.direction === 'up' ? 'trending-up' : trend.direction === 'down' ? 'trending-down' : 'minus'}
            size={16}
            style={{ color: trendColors[trend.direction] }}
          />
          <span style={{ fontSize: '13px', fontWeight: 500, color: trendColors[trend.direction] }}>
            {trend.percent}%
          </span>
          {period ? <span style={periodStyle}>{period}</span> : null}
        </div>
      ) : period ? (
        <div style={{ marginTop: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--brand-text-secondary)' }}>{period}</span>
        </div>
      ) : null}
    </div>
  )
}

export default StatCard
