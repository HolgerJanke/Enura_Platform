import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '13px', lineHeight: '18px' },
  md: { padding: '8px 16px', fontSize: '14px', lineHeight: '20px' },
  lg: { padding: '12px 24px', fontSize: '16px', lineHeight: '24px' },
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--brand-primary)',
    color: '#ffffff',
    border: '1px solid transparent',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--brand-text-primary)',
    border: '1px solid var(--brand-text-secondary)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--brand-text-primary)',
    border: '1px solid transparent',
  },
  danger: {
    backgroundColor: '#DC2626',
    color: '#ffffff',
    border: '1px solid transparent',
  },
}

const Spinner: React.FC<{ size: NonNullable<ButtonProps['size']> }> = ({ size }) => {
  const dimension = size === 'sm' ? 14 : size === 'lg' ? 20 : 16
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'enura-spin 1s linear infinite', marginRight: '6px', flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        opacity={0.25}
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="23.55"
      />
    </svg>
  )
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, children, style, className, ...rest },
  ref,
) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    fontFamily: 'var(--brand-font, inherit)',
    borderRadius: 'var(--brand-radius, 8px)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 150ms ease, opacity 150ms ease, box-shadow 150ms ease',
    outline: 'none',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  }

  return (
    <>
      <style>{`@keyframes enura-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <button
        ref={ref}
        className={className}
        style={baseStyle}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <Spinner size={size} /> : null}
        {children}
      </button>
    </>
  )
})

export default Button
