'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'
import { BrandTokensSchema } from '@enura/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireHoldingSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isHoldingAdmin) redirect('/login')
  if (!session.holdingId) {
    throw new Error('Kein Holding zugewiesen.')
  }
  return { session, holdingId: session.holdingId, userId: session.profile.id }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrandingData = {
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
  logoUrl: string | null
}

// ---------------------------------------------------------------------------
// getHoldingBranding — fetch branding from holdings.branding JSONB
// ---------------------------------------------------------------------------

export async function getHoldingBranding(): Promise<BrandingData> {
  const { holdingId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { data: holding } = await supabase
    .from('holdings')
    .select('branding')
    .eq('id', holdingId)
    .single()

  const branding = (holding?.branding ?? {}) as Record<string, unknown>

  return {
    primary: (branding['primary'] as string) ?? '#1A56DB',
    secondary: (branding['secondary'] as string) ?? '#1A1A1A',
    accent: (branding['accent'] as string) ?? '#F3A917',
    background: (branding['background'] as string) ?? '#FFFFFF',
    surface: (branding['surface'] as string) ?? '#F9FAFB',
    textPrimary: (branding['textPrimary'] as string) ?? '#111827',
    textSecondary: (branding['textSecondary'] as string) ?? '#6B7280',
    font: (branding['font'] as string) ?? 'Inter',
    fontUrl: (branding['fontUrl'] as string | null) ?? null,
    radius: (branding['radius'] as string) ?? '8px',
    darkModeEnabled: (branding['darkModeEnabled'] as boolean) ?? true,
    logoUrl: (branding['logoUrl'] as string | null) ?? null,
  }
}

// ---------------------------------------------------------------------------
// saveBranding — persist holding branding, optionally upload logo
// ---------------------------------------------------------------------------

export async function saveBranding(
  data: BrandingData,
): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Validate color tokens
  const parseResult = BrandTokensSchema.safeParse({
    primary: data.primary,
    secondary: data.secondary,
    accent: data.accent,
    background: data.background,
    surface: data.surface,
    textPrimary: data.textPrimary,
    textSecondary: data.textSecondary,
    font: data.font,
    fontUrl: data.fontUrl,
    radius: data.radius,
    darkModeEnabled: data.darkModeEnabled,
  })

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]
    return {
      success: false,
      error: `Validierungsfehler: ${firstIssue?.path.join('.')} — ${firstIssue?.message}`,
    }
  }

  // Fetch old branding for audit diff
  const { data: holdingBefore } = await supabase
    .from('holdings')
    .select('branding')
    .eq('id', holdingId)
    .single()

  const brandingPayload: Record<string, unknown> = {
    primary: data.primary,
    secondary: data.secondary,
    accent: data.accent,
    background: data.background,
    surface: data.surface,
    textPrimary: data.textPrimary,
    textSecondary: data.textSecondary,
    font: data.font,
    fontUrl: data.fontUrl,
    radius: data.radius,
    darkModeEnabled: data.darkModeEnabled,
    logoUrl: data.logoUrl,
  }

  const { error } = await supabase
    .from('holdings')
    .update({ branding: brandingPayload })
    .eq('id', holdingId)

  if (error) {
    return { success: false, error: `Fehler beim Speichern: ${error.message}` }
  }

  await writeAuditLog({
    companyId: null,
    actorId: userId,
    action: 'holding.branding.updated',
    tableName: 'holdings',
    recordId: holdingId,
    oldValues: holdingBefore?.branding as Record<string, unknown> | undefined,
    newValues: brandingPayload,
  })

  revalidatePath('/admin/settings/branding')
  return { success: true }
}

// ---------------------------------------------------------------------------
// uploadLogo — upload logo to holding-assets bucket
// ---------------------------------------------------------------------------

export async function uploadLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  const { holdingId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const file = formData.get('logo') as File | null
  if (!file) {
    return { error: 'Keine Datei ausgewaehlt.' }
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Nur PNG, JPEG, SVG und WebP sind erlaubt.' }
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return { error: 'Die Datei darf maximal 2 MB gross sein.' }
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const storagePath = `holding-logos/${holdingId}/logo-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('holding-assets')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return { error: `Upload fehlgeschlagen: ${uploadError.message}` }
  }

  const { data: urlData } = supabase.storage
    .from('holding-assets')
    .getPublicUrl(storagePath)

  return { url: urlData.publicUrl }
}

// ---------------------------------------------------------------------------
// getCompanyBranding — fetch company branding overrides
// ---------------------------------------------------------------------------

export async function getCompanyBranding(companyId: string): Promise<{
  holdingBranding: BrandingData
  companyOverrides: Record<string, unknown>
  companyName: string
} | null> {
  const { holdingId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Verify company belongs to holding
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, holding_id')
    .eq('id', companyId)
    .eq('holding_id', holdingId)
    .single()

  if (!company) return null

  const holdingBranding = await getHoldingBranding()

  // Fetch company branding row
  const { data: compBranding } = await supabase
    .from('company_branding')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  const overrides: Record<string, unknown> = {}
  if (compBranding) {
    if (compBranding.primary_color) overrides['primary'] = compBranding.primary_color
    if (compBranding.secondary_color) overrides['secondary'] = compBranding.secondary_color
    if (compBranding.accent_color) overrides['accent'] = compBranding.accent_color
    if (compBranding.background_color) overrides['background'] = compBranding.background_color
    if (compBranding.surface_color) overrides['surface'] = compBranding.surface_color
    if (compBranding.text_primary) overrides['textPrimary'] = compBranding.text_primary
    if (compBranding.text_secondary) overrides['textSecondary'] = compBranding.text_secondary
    if (compBranding.font_family) overrides['font'] = compBranding.font_family
    if (compBranding.border_radius) overrides['radius'] = compBranding.border_radius
    if (compBranding.logo_url) overrides['logoUrl'] = compBranding.logo_url
  }

  return {
    holdingBranding,
    companyOverrides: overrides,
    companyName: company.name,
  }
}

// ---------------------------------------------------------------------------
// saveCompanyBrandingOverrides — save only overridden values
// ---------------------------------------------------------------------------

export async function saveCompanyBrandingOverrides(
  companyId: string,
  overrides: Record<string, string | boolean | null>,
): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Verify company belongs to holding
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .eq('holding_id', holdingId)
    .single()

  if (!company) {
    return { success: false, error: 'Ungueltiges Unternehmen.' }
  }

  const updatePayload: Record<string, unknown> = {}
  if ('primary' in overrides) updatePayload['primary_color'] = overrides['primary']
  if ('secondary' in overrides) updatePayload['secondary_color'] = overrides['secondary']
  if ('accent' in overrides) updatePayload['accent_color'] = overrides['accent']
  if ('background' in overrides) updatePayload['background_color'] = overrides['background']
  if ('surface' in overrides) updatePayload['surface_color'] = overrides['surface']
  if ('textPrimary' in overrides) updatePayload['text_primary'] = overrides['textPrimary']
  if ('textSecondary' in overrides) updatePayload['text_secondary'] = overrides['textSecondary']
  if ('font' in overrides) updatePayload['font_family'] = overrides['font']
  if ('radius' in overrides) updatePayload['border_radius'] = overrides['radius']
  if ('logoUrl' in overrides) updatePayload['logo_url'] = overrides['logoUrl']
  if ('darkModeEnabled' in overrides) updatePayload['dark_mode_enabled'] = overrides['darkModeEnabled']

  const { error } = await supabase
    .from('company_branding')
    .upsert(
      { company_id: companyId, holding_id: holdingId, ...updatePayload },
      { onConflict: 'company_id' },
    )

  if (error) {
    return { success: false, error: `Fehler beim Speichern: ${error.message}` }
  }

  await writeAuditLog({
    companyId,
    actorId: userId,
    action: 'company.branding.updated',
    tableName: 'company_branding',
    recordId: companyId,
    newValues: overrides as Record<string, unknown>,
  })

  revalidatePath(`/admin/companies/${companyId}/branding`)
  return { success: true }
}
