/**
 * Format a number as CHF currency: CHF 12'450.00
 */
export function formatCHF(amount: number): string {
  const formatted = new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `CHF ${formatted}`
}

/**
 * Format a number as CHF without decimals: CHF 12'450
 */
export function formatCHFShort(amount: number): string {
  const formatted = new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `CHF ${formatted}`
}

/**
 * Format a decimal as percentage: 48.3 %
 * Input is 0-1 (e.g. 0.483 -> "48.3 %")
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)} %`
}

/**
 * Format a whole number with Swiss grouping: 1'234
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-CH').format(value)
}

/**
 * Format a date as Swiss date: 23.03.2026
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Format a date with time: 23.03.2026, 14:30
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dateStr = formatDate(d)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${dateStr}, ${hours}:${minutes}`
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format a relative time: "vor 2 Stunden", "vor 3 Tagen"
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Minuten`
  if (diffHours < 24) return `vor ${diffHours} Stunden`
  if (diffDays < 30) return `vor ${diffDays} Tagen`
  return formatDate(d)
}
