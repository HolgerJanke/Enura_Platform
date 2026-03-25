import React from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, className, style }) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    fontFamily: 'var(--brand-font, inherit)',
    ...style,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--brand-text-primary)',
    lineHeight: '32px',
    margin: 0,
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--brand-text-secondary)',
    lineHeight: '20px',
    margin: '4px 0 0 0',
  }

  return (
    <div className={className} style={containerStyle}>
      <div>
        <h1 style={titleStyle}>{title}</h1>
        {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>{actions}</div> : null}
    </div>
  )
}

export default PageHeader
