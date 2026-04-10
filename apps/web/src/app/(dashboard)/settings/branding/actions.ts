'use server'

import { getSession } from '@/lib/session'
import { getCompanyContext } from '@/lib/tenant'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sanitizeCSS } from '@/lib/css-sanitizer'
import {
  type ExtendedBrandTokens,
  type BrandTokens,
  defaultExtendedTokens,
  defaultBrandTokens,
  brandTokensFromRow,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyDesignData {
  companyBranding: {
    tokens: BrandTokens
    extendedTokens: Partial<ExtendedBrandTokens> | null
    customCSSPath: string | null
  }
  holdingBranding: {
    tokens: BrandTokens
    extendedTokens: Partial<ExtendedBrandTokens>
  }
}

interface BrandingRow {
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
  extended_tokens: Partial<ExtendedBrandTokens> | null
  custom_css_path: string | null
}

// ---------------------------------------------------------------------------
// getCompanyDesign
// ---------------------------------------------------------------------------

export async function getCompanyDesign(): Promise<{
  data: CompanyDesignData | null
  error: string | null
}> {
  const session = await getSession()
  if (!session?.companyId) {
    return { data: null, error: 'Nicht autorisiert' }
  }

  if (
    !session.isHoldingAdmin &&
    !session.permissions.includes('module:admin:branding')
  ) {
    return { data: null, error: 'Nicht autorisiert' }
  }

  const supabase = createSupabaseServerClient()

  // Fetch company branding
  const { data: companyRow } = await supabase
    .from('company_branding')
    .select(
      'primary_color, secondary_color, accent_color, background_color, surface_color, text_primary, text_secondary, font_family, font_url, border_radius, dark_mode_enabled, extended_tokens, custom_css_path',
    )
    .eq('company_id', session.companyId)
    .single<BrandingRow>()

  const companyTokens = companyRow
    ? brandTokensFromRow(companyRow)
    : defaultBrandTokens

  // Fetch holding branding (from company's holding)
  const holdingTokens = defaultBrandTokens
  const holdingExtended: Partial<ExtendedBrandTokens> = { ...defaultExtendedTokens }

  // Try to fetch holding branding if holding_id exists
  if (session.holdingId) {
    const { data: holdingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('holding_id', session.holdingId)
      .eq('is_holding_company', true)
      .maybeSingle<{ id: string }>()

    if (holdingCompany) {
      const { data: holdingRow } = await supabase
        .from('company_branding')
        .select(
          'primary_color, secondary_color, accent_color, background_color, surface_color, text_primary, text_secondary, font_family, font_url, border_radius, dark_mode_enabled, extended_tokens, custom_css_path',
        )
        .eq('company_id', holdingCompany.id)
        .single<BrandingRow>()

      if (holdingRow) {
        const resolvedHolding = brandTokensFromRow(holdingRow)
        Object.assign(holdingTokens, resolvedHolding)
        if (holdingRow.extended_tokens) {
          Object.assign(holdingExtended, holdingRow.extended_tokens)
        }
      }
    }
  }

  return {
    data: {
      companyBranding: {
        tokens: companyTokens,
        extendedTokens: companyRow?.extended_tokens ?? null,
        customCSSPath: companyRow?.custom_css_path ?? null,
      },
      holdingBranding: {
        tokens: holdingTokens,
        extendedTokens: holdingExtended,
      },
    },
    error: null,
  }
}

// ---------------------------------------------------------------------------
// saveExtendedTokens
// ---------------------------------------------------------------------------

export async function saveExtendedTokens(
  tokens: Partial<ExtendedBrandTokens>,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.companyId) return { error: 'Nicht autorisiert' }

  if (
    !session.isHoldingAdmin &&
    !session.permissions.includes('module:admin:branding')
  ) {
    return { error: 'Nicht autorisiert' }
  }

  const db = createSupabaseServiceClient()

  const { error } = await db
    .from('company_branding')
    .update({ extended_tokens: tokens })
    .eq('company_id', session.companyId)

  if (error) {
    return { error: 'Erweiterte Designwerte konnten nicht gespeichert werden.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// uploadCustomCSS
// ---------------------------------------------------------------------------

export async function uploadCustomCSS(
  formData: FormData,
): Promise<{ error?: string; errors?: string[]; success?: boolean }> {
  const session = await getSession()
  if (!session?.companyId) return { error: 'Nicht autorisiert' }

  if (
    !session.isHoldingAdmin &&
    !session.permissions.includes('module:admin:branding')
  ) {
    return { error: 'Nicht autorisiert' }
  }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'Keine Datei ausgewählt.' }

  if (!file.name.endsWith('.css')) {
    return { error: 'Nur .css-Dateien sind erlaubt.' }
  }

  const raw = await file.text()
  const result = sanitizeCSS(raw)

  if (!result.success) {
    return { error: 'CSS-Validierung fehlgeschlagen.', errors: result.errors }
  }

  const db = createSupabaseServiceClient()
  const { companyId } = getCompanyContext()
  const targetCompanyId = companyId || session.companyId
  const timestamp = Date.now()
  const storagePath = `${targetCompanyId}/custom-${timestamp}.css`

  // Fetch current custom_css_path for cleanup
  const { data: currentBranding } = await db
    .from('company_branding')
    .select('custom_css_path')
    .eq('company_id', session.companyId)
    .single<{ custom_css_path: string | null }>()

  // Upload sanitized CSS to Supabase Storage
  const { error: uploadError } = await db.storage
    .from('corporate-assets')
    .upload(storagePath, new Blob([result.sanitized ?? ''], { type: 'text/css' }), {
      contentType: 'text/css',
      upsert: false,
    })

  if (uploadError) {
    return { error: 'CSS-Datei konnte nicht hochgeladen werden.' }
  }

  // Update branding record
  const { error: updateError } = await db
    .from('company_branding')
    .update({
      custom_css_path: storagePath,
      custom_css_updated_at: new Date().toISOString(),
      custom_css_uploaded_by: session.profile.id,
    })
    .eq('company_id', session.companyId)

  if (updateError) {
    // Try to clean up the uploaded file
    await db.storage.from('corporate-assets').remove([storagePath])
    return { error: 'Branding-Datensatz konnte nicht aktualisiert werden.' }
  }

  // Delete old CSS file if it exists
  if (currentBranding?.custom_css_path) {
    await db.storage
      .from('corporate-assets')
      .remove([currentBranding.custom_css_path])
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteCustomCSS
// ---------------------------------------------------------------------------

export async function deleteCustomCSS(): Promise<{
  error?: string
  success?: boolean
}> {
  const session = await getSession()
  if (!session?.companyId) return { error: 'Nicht autorisiert' }

  if (
    !session.isHoldingAdmin &&
    !session.permissions.includes('module:admin:branding')
  ) {
    return { error: 'Nicht autorisiert' }
  }

  const db = createSupabaseServiceClient()

  // Fetch current path
  const { data: currentBranding } = await db
    .from('company_branding')
    .select('custom_css_path')
    .eq('company_id', session.companyId)
    .single<{ custom_css_path: string | null }>()

  if (!currentBranding?.custom_css_path) {
    return { error: 'Keine benutzerdefinierte CSS-Datei vorhanden.' }
  }

  // Delete from storage
  await db.storage
    .from('corporate-assets')
    .remove([currentBranding.custom_css_path])

  // Clear in DB
  const { error: updateError } = await db
    .from('company_branding')
    .update({
      custom_css_path: null,
      custom_css_updated_at: null,
      custom_css_uploaded_by: null,
    })
    .eq('company_id', session.companyId)

  if (updateError) {
    return { error: 'Branding-Datensatz konnte nicht aktualisiert werden.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// saveCompanyBrandTokens — save core brand color overrides
// ---------------------------------------------------------------------------

const BRAND_COLUMN_MAP: Record<string, string> = {
  primary: 'primary_color',
  secondary: 'secondary_color',
  accent: 'accent_color',
  background: 'background_color',
  surface: 'surface_color',
  textPrimary: 'text_primary',
  textSecondary: 'text_secondary',
  font: 'font_family',
  fontUrl: 'font_url',
  radius: 'border_radius',
}

export async function saveCompanyBrandTokens(
  tokens: Record<string, string>,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.companyId) return { error: 'Nicht autorisiert' }

  // Map camelCase token keys to snake_case DB columns
  const updatePayload: Record<string, string> = {}
  for (const [key, value] of Object.entries(tokens)) {
    const column = BRAND_COLUMN_MAP[key]
    if (column && value) {
      updatePayload[column] = value
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return { error: 'Keine Änderungen vorhanden.' }
  }

  try {
    const db = createSupabaseServiceClient()
    const { error } = await db
      .from('company_branding')
      .update(updatePayload)
      .eq('company_id', session.companyId)

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Speichern fehlgeschlagen.' }
  }
}
