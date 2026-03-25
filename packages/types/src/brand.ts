export type BrandTokens = {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  textPrimary: string
  textSecondary: string
  font: string
  fontUrl: string | null
  radius: string
  darkModeEnabled: boolean
}

export const defaultBrandTokens: BrandTokens = {
  primary: '#1A56DB',
  secondary: '#1A1A1A',
  accent: '#F3A917',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  font: 'Inter',
  fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
  radius: '8px',
  darkModeEnabled: true,
}

export function buildCSSVars(tokens: BrandTokens): Record<string, string> {
  return {
    '--brand-primary': tokens.primary,
    '--brand-secondary': tokens.secondary,
    '--brand-accent': tokens.accent,
    '--brand-background': tokens.background,
    '--brand-surface': tokens.surface,
    '--brand-text-primary': tokens.textPrimary,
    '--brand-text-secondary': tokens.textSecondary,
    '--brand-font': tokens.font,
    '--brand-radius': tokens.radius,
  }
}

export function buildCSSVarString(tokens: BrandTokens): string {
  const vars = buildCSSVars(tokens)
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

export function brandTokensFromRow(row: {
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  surface_color: string
  text_primary: string
  text_secondary: string
  font_family: string
  font_url: string | null
  border_radius: string
  dark_mode_enabled: boolean
}): BrandTokens {
  return {
    primary: row.primary_color,
    secondary: row.secondary_color,
    accent: row.accent_color,
    background: row.background_color,
    surface: row.surface_color,
    textPrimary: row.text_primary,
    textSecondary: row.text_secondary,
    font: row.font_family,
    fontUrl: row.font_url,
    radius: row.border_radius,
    darkModeEnabled: row.dark_mode_enabled,
  }
}
