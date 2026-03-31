const MAX_CSS_SIZE = 100 * 1024 // 100KB

const BLOCKED_AT_RULES = ['import', 'charset']
const BLOCKED_PROPERTIES = ['behavior', '-moz-binding']
const BLOCKED_VALUE_PATTERNS = [
  /expression\s*\(/i,
  /javascript\s*:/i,
  /url\s*\(\s*['"]?\s*javascript/i,
  /\\[0-9a-fA-F]/, // Unicode escape obfuscation
]

export type SanitizeResult = {
  success: boolean
  sanitized?: string
  errors: string[]
}

export function sanitizeCSS(raw: string): SanitizeResult {
  const errors: string[] = []

  // Size check
  if (new TextEncoder().encode(raw).length > MAX_CSS_SIZE) {
    return { success: false, errors: ['CSS-Datei überschreitet die maximale Grösse von 100 KB.'] }
  }

  // Check for blocked @-rules
  for (const rule of BLOCKED_AT_RULES) {
    const regex = new RegExp(`@${rule}\\b`, 'gi')
    if (regex.test(raw)) {
      errors.push(`@${rule}-Regeln sind nicht erlaubt.`)
    }
  }

  // Check for blocked properties
  for (const prop of BLOCKED_PROPERTIES) {
    const regex = new RegExp(`\\b${prop.replace('-', '\\-')}\\s*:`, 'gi')
    if (regex.test(raw)) {
      errors.push(`Die CSS-Eigenschaft "${prop}" ist nicht erlaubt.`)
    }
  }

  // Check for blocked value patterns
  for (const pattern of BLOCKED_VALUE_PATTERNS) {
    if (pattern.test(raw)) {
      errors.push(`Verdächtiger CSS-Wert erkannt: ${pattern.source}`)
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  // Scope all rules under :where(body) to prevent escaping to <html>/:root
  // This adds zero specificity so company CSS doesn't accidentally override critical layout
  const scoped = `:where(body) {\n${raw}\n}`

  return { success: true, sanitized: scoped, errors: [] }
}
