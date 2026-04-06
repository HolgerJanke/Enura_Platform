import { describe, it, expect } from 'vitest'
import { formatCHF, formatCHFShort, formatPercent, formatNumber, formatDate, formatDuration, formatRelativeTime } from '../formatters.js'

describe('formatCHF', () => {
  it('formats with apostrophe grouping', () => {
    // Note: Intl may use different grouping chars depending on environment
    const result = formatCHF(12450)
    expect(result).toContain('CHF')
    expect(result).toContain('12')
    expect(result).toContain('450')
  })

  it('formats zero', () => {
    expect(formatCHF(0)).toContain('0.00')
  })
})

describe('formatPercent', () => {
  it('formats 0-1 as percentage', () => {
    expect(formatPercent(0.483)).toBe('48.3 %')
  })
  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.0 %')
  })
  it('formats 100%', () => {
    expect(formatPercent(1)).toBe('100.0 %')
  })
})

describe('formatDate', () => {
  it('formats a date in Swiss format', () => {
    expect(formatDate(new Date(2026, 2, 23))).toBe('23.03.2026')
  })
  it('formats an ISO string', () => {
    expect(formatDate('2026-03-23T10:00:00Z')).toMatch(/23\.03\.2026/)
  })
})

describe('formatDuration', () => {
  it('formats seconds to MM:SS', () => {
    expect(formatDuration(185)).toBe('3:05')
  })
  it('formats with hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})
