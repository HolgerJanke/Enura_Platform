import React from 'react'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

const spinnerSizes: Record<NonNullable<LoadingSpinnerProps['size']>, number> = {
  sm: 20,
  md: 32,
  lg: 48,
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className, style }) => {
  const dimension = spinnerSizes[size]

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    ...style,
  }

  return (
    <div className={className} style={containerStyle} role="status" aria-label="Loading">
      <style>{`@keyframes enura-spinner-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'enura-spinner-rotate 0.8s linear infinite' }}
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="color-mix(in srgb, var(--brand-primary) 20%, transparent)"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="var(--brand-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  )
}

export default LoadingSpinner
