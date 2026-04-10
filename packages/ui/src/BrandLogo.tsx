import React from 'react'

export interface BrandLogoProps {
  logoUrl?: string
  tenantName: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

const logoSizes: Record<NonNullable<BrandLogoProps['size']>, { height: number; fontSize: number }> = {
  sm: { height: 24, fontSize: 14 },
  md: { height: 32, fontSize: 16 },
  lg: { height: 48, fontSize: 22 },
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ logoUrl, tenantName, size = 'md', className, style }) => {
  const { height, fontSize } = logoSizes[size]

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${tenantName} logo`}
        className={className}
        style={{
          height,
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
          ...style,
        }}
      />
    )
  }

  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight: 700,
    color: 'var(--brand-primary)',
    fontFamily: 'var(--brand-font, inherit)',
    lineHeight: `${height}px`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    ...style,
  }

  return (
    <span className={className} style={textStyle} aria-label={`${tenantName} logo`}>
      {tenantName}
    </span>
  )
}

export default BrandLogo
