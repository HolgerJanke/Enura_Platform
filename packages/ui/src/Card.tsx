import React from 'react'

export interface CardProps {
  children: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Card: React.FC<CardProps> = ({ children, header, footer, className, style }) => {
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--brand-surface)',
    borderRadius: 'var(--brand-radius, 8px)',
    border: '1px solid color-mix(in srgb, var(--brand-text-secondary) 20%, transparent)',
    overflow: 'hidden',
    fontFamily: 'var(--brand-font, inherit)',
    ...style,
  }

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: '1px solid color-mix(in srgb, var(--brand-text-secondary) 20%, transparent)',
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--brand-text-primary)',
  }

  const bodyStyle: React.CSSProperties = {
    padding: '16px 20px',
  }

  const footerStyle: React.CSSProperties = {
    padding: '12px 20px',
    borderTop: '1px solid color-mix(in srgb, var(--brand-text-secondary) 20%, transparent)',
  }

  return (
    <div className={className} style={cardStyle}>
      {header !== undefined ? <div style={headerStyle}>{header}</div> : null}
      <div style={bodyStyle}>{children}</div>
      {footer !== undefined ? <div style={footerStyle}>{footer}</div> : null}
    </div>
  )
}

export default Card
