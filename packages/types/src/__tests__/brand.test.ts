import { describe, it, expect } from 'vitest'
import { buildCSSVars, buildCSSVarString, defaultBrandTokens } from '../brand.js'

describe('buildCSSVars', () => {
  it('returns a record of CSS custom properties', () => {
    const vars = buildCSSVars(defaultBrandTokens)
    expect(vars['--brand-primary']).toBe('#1A56DB')
    expect(vars['--brand-secondary']).toBe('#1A1A1A')
    expect(vars['--brand-accent']).toBe('#F3A917')
    expect(vars['--brand-background']).toBe('#FFFFFF')
    expect(vars['--brand-surface']).toBe('#F9FAFB')
    expect(vars['--brand-text-primary']).toBe('#111827')
    expect(vars['--brand-text-secondary']).toBe('#6B7280')
    expect(vars['--brand-font']).toBe('Inter')
    expect(vars['--brand-radius']).toBe('8px')
  })

  it('maps custom brand tokens correctly', () => {
    const custom = {
      ...defaultBrandTokens,
      primary: '#059669',
      font: 'Roboto',
    }
    const vars = buildCSSVars(custom)
    expect(vars['--brand-primary']).toBe('#059669')
    expect(vars['--brand-font']).toBe('Roboto')
  })
})

describe('buildCSSVarString', () => {
  it('returns a semicolon-separated CSS string', () => {
    const str = buildCSSVarString(defaultBrandTokens)
    expect(str).toContain('--brand-primary:#1A56DB')
    expect(str).toContain('--brand-font:Inter')
    expect(str.split(';').length).toBe(9)
  })
})
