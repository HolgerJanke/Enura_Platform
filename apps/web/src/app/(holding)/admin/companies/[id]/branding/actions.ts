'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireHoldingSession() {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin) throw new Error('Kein Zugriff')
  if (!session.holdingId) {
    throw new Error('Kein Holding zugewiesen.')
  }
  return { session, holdingId: session.holdingId, userId: session.profile.id }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompanyBrandingOverrides = {
  primary?: string | null
  secondary?: string | null
  accent?: string | null
  background?: string | null
  surface?: string | null
  textPrimary?: string | null
  textSecondary?: string | null
  font?: string | null
  radius?: string | null
  logoUrl?: string | null
  darkModeEnabled?: boolean | null
}

// ---------------------------------------------------------------------------
// saveCompanyBranding — updates company_branding row with override values
// ---------------------------------------------------------------------------

export async function saveCompanyBranding(
  companyId: string,
  overrides: CompanyBrandingOverrides,
): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Verify company belongs to holding
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .eq('holding_id', holdingId)
    .single()

  if (!company) {
    return { success: false, error: 'Ungueltiges Unternehmen oder kein Zugriff.' }
  }

  // Map camelCase keys to snake_case DB columns
  const updatePayload: Record<string, unknown> = {}

  if (overrides.primary !== undefined) updatePayload['primary_color'] = overrides.primary
  if (overrides.secondary !== undefined) updatePayload['secondary_color'] = overrides.secondary
  if (overrides.accent !== undefined) updatePayload['accent_color'] = overrides.accent
  if (overrides.background !== undefined) updatePayload['background_color'] = overrides.background
  if (overrides.surface !== undefined) updatePayload['surface_color'] = overrides.surface
  if (overrides.textPrimary !== undefined) updatePayload['text_primary'] = overrides.textPrimary
  if (overrides.textSecondary !== undefined) updatePayload['text_secondary'] = overrides.textSecondary
  if (overrides.font !== undefined) updatePayload['font_family'] = overrides.font
  if (overrides.radius !== undefined) updatePayload['border_radius'] = overrides.radius
  if (overrides.logoUrl !== undefined) updatePayload['logo_url'] = overrides.logoUrl
  if (overrides.darkModeEnabled !== undefined) updatePayload['dark_mode_enabled'] = overrides.darkModeEnabled

  // Fetch old branding for audit diff
  const { data: existingBranding } = await supabase
    .from('company_branding')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  const oldValues = existingBranding
    ? (existingBranding as Record<string, unknown>)
    : undefined

  // Upsert: create if not exists, update if exists
  const { error } = await supabase
    .from('company_branding')
    .upsert(
      {
        company_id: companyId,
        holding_id: holdingId,
        ...updatePayload,
      },
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
    oldValues,
    newValues: updatePayload,
  })

  revalidatePath(`/admin/companies/${companyId}/branding`)
  return { success: true }
}
