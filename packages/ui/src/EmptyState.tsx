import React from 'react'

import { Button } from './Button'
import { Icon } from './Icon'

export interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  style?: React.CSSProperties
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  className,
  style,
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 24px',
    fontFamily: 'var(--brand-font, inherit)',
    ...style,
  }

  const iconContainerStyle: React.CSSProperties = {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    color: 'var(--brand-primary)',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--brand-text-primary)',
    margin: '0 0 8px 0',
  }

  const descStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--brand-text-secondary)',
    margin: 0,
    maxWidth: '360px',
    lineHeight: '20px',
  }

  return (
    <div className={className} style={containerStyle}>
      <div style={iconContainerStyle}>
        <Icon name="clipboard" size={24} />
      </div>
      <h3 style={titleStyle}>{title}</h3>
      <p style={descStyle}>{description}</p>
      {actionLabel && onAction ? (
        <div style={{ marginTop: '20px' }}>
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default EmptyState
