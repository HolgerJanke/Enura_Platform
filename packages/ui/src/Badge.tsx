import React from 'react'

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

const variantColors: Record<NonNullable<BadgeProps['variant']>, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: '#166534' },
  warning: { bg: '#FEF9C3', text: '#854D0E' },
  danger: { bg: '#FEE2E2', text: '#991B1B' },
  info: { bg: '#DBEAFE', text: '#1E40AF' },
  neutral: { bg: '#F3F4F6', text: '#374151' },
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className, style }) => {
  const colors = variantColors[variant]

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: '18px',
    borderRadius: '9999px',
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: 'var(--brand-font, inherit)',
    whiteSpace: 'nowrap',
    ...style,
  }

  return (
    <span className={className} style={badgeStyle}>
      {children}
    </span>
  )
}

export default Badge
