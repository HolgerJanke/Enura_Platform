import React from 'react'

export interface AvatarProps {
  name: string
  imageUrl?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

const sizeDimensions: Record<NonNullable<AvatarProps['size']>, { dimension: number; fontSize: number }> = {
  sm: { dimension: 32, fontSize: 12 },
  md: { dimension: 40, fontSize: 14 },
  lg: { dimension: 56, fontSize: 18 },
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export const Avatar: React.FC<AvatarProps> = ({ name, imageUrl, size = 'md', className, style }) => {
  const { dimension, fontSize } = sizeDimensions[size]

  const baseStyle: React.CSSProperties = {
    width: dimension,
    height: dimension,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  }

  if (imageUrl) {
    return (
      <div className={className} style={baseStyle} role="img" aria-label={name}>
        <img
          src={imageUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  const initialsStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: 'var(--brand-primary)',
    color: '#ffffff',
    fontSize,
    fontWeight: 600,
    fontFamily: 'var(--brand-font, inherit)',
    userSelect: 'none',
  }

  return (
    <div className={className} style={initialsStyle} role="img" aria-label={name}>
      {getInitials(name)}
    </div>
  )
}

export default Avatar
