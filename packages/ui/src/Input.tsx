import React from 'react'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, id, required, className, style, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  const errorId = error && inputId ? `${inputId}-error` : undefined
  const helperId = helperText && inputId ? `${inputId}-helper` : undefined

  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontFamily: 'var(--brand-font, inherit)',
    ...style,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--brand-text-primary)',
    lineHeight: '20px',
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '14px',
    lineHeight: '20px',
    color: 'var(--brand-text-primary)',
    backgroundColor: 'var(--brand-surface)',
    border: error ? '1px solid #DC2626' : '1px solid var(--brand-text-secondary)',
    borderRadius: 'var(--brand-radius, 8px)',
    outline: 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#DC2626',
    lineHeight: '18px',
    margin: 0,
  }

  const helperStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--brand-text-secondary)',
    lineHeight: '18px',
    margin: 0,
  }

  return (
    <div className={className} style={containerStyle}>
      {label ? (
        <label htmlFor={inputId} style={labelStyle}>
          {label}
          {required ? <span style={{ color: '#DC2626', marginLeft: '2px' }} aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--brand-primary)'
          e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--brand-primary) 25%, transparent)'
          rest.onFocus?.(e)
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? '#DC2626' : 'var(--brand-text-secondary)'
          e.currentTarget.style.boxShadow = 'none'
          rest.onBlur?.(e)
        }}
        {...rest}
      />
      {error ? <p id={errorId} style={errorStyle} role="alert">{error}</p> : null}
      {helperText && !error ? <p id={helperId} style={helperStyle}>{helperText}</p> : null}
    </div>
  )
})

export default Input
