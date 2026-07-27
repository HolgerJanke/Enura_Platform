'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { requireHoldingSession, type HoldingSession } from '@/lib/permissions'
import type { TenantStatus } from '@enura/types'

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

/**
 * Load a company only if the caller is allowed to administer it.
 *
 * The company id arrives from the client, so ownership must be proven before any
 * mutation — otherwise a holding admin can rebrand or suspend companies in other
 * holdings. Returns null when the company is missing OR out of scope; callers
 * report both identically so existence is not leaked.
 */
async function loadAdministrableCompany(
  serviceClient: ReturnType<typeof createSupabaseServiceClient>,
  holdingSession: HoldingSession,
  companyId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await serviceClient
    .from('companies')
    .select('id, slug, status, holding_id')
    .eq('id', companyId)
    .single()

  if (!data) return null

  const row = data as Record<string, unknown>
  if (
    holdingSession.holdingId &&
    row['holding_id'] !== holdingSession.holdingId
  ) {
    return null
  }
  return row
}

type BrandingUpdate = {
  primary_color: string
  secondary_color: string
  accent_color: string
  font_family: string
  border_radius: string
}

export async function updateTenantBrandingAction(
  companyId: string,
  branding: BrandingUpdate,
): Promise<{ error?: string }> {
  const holdingSession = await requireHoldingSession()
  if (!holdingSession) {
    return { error: 'Nicht autorisiert.' }
  }

  if (!HEX_COLOR_REGEX.test(branding.primary_color)) {
    return { error: 'Ungültige Primärfarbe.' }
  }
  if (!HEX_COLOR_REGEX.test(branding.secondary_color)) {
    return { error: 'Ungültige Sekundärfarbe.' }
  }
  if (!HEX_COLOR_REGEX.test(branding.accent_color)) {
    return { error: 'Ungültige Akzentfarbe.' }
  }
  if (!branding.font_family || branding.font_family.length < 1) {
    return { error: 'Bitte geben Sie eine Schriftart an.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Verify the tenant exists AND belongs to the caller's holding.
  const tenant = await loadAdministrableCompany(
    serviceClient,
    holdingSession,
    companyId,
  )

  if (!tenant) {
    return { error: 'Unternehmen nicht gefunden.' }
  }

  // Fetch current branding for audit log
  const { data: currentBranding } = await serviceClient
    .from('company_branding')
    .select('primary_color, secondary_color, accent_color, font_family, border_radius')
    .eq('company_id', companyId)
    .single()

  const { error: updateError } = await serviceClient
    .from('company_branding')
    .update({
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      accent_color: branding.accent_color,
      font_family: branding.font_family,
      border_radius: branding.border_radius,
    })
    .eq('company_id', companyId)

  if (updateError) {
    console.error('[admin] Failed to update branding:', updateError)
    return { error: 'Branding konnte nicht aktualisiert werden.' }
  }

  await writeAuditLog({
    companyId,
    actorId: holdingSession.session.profile.id,
    action: 'tenant_branding.updated',
    tableName: 'tenant_brandings',
    recordId: companyId,
    oldValues: currentBranding ? { ...currentBranding } : undefined,
    newValues: { ...branding },
  })

  revalidatePath(`/admin/tenants/${tenant['slug'] as string}`)
  return {}
}

export async function updateTenantStatusAction(
  companyId: string,
  status: TenantStatus,
): Promise<{ error?: string }> {
  const holdingSession = await requireHoldingSession()
  if (!holdingSession) {
    return { error: 'Nicht autorisiert.' }
  }

  const validStatuses: TenantStatus[] = ['active', 'suspended', 'archived']
  if (!validStatuses.includes(status)) {
    return { error: 'Ungültiger Status.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Fetch current tenant for the audit log, and confirm it is in scope.
  const tenant = await loadAdministrableCompany(
    serviceClient,
    holdingSession,
    companyId,
  )

  if (!tenant) {
    return { error: 'Unternehmen nicht gefunden.' }
  }

  const { error: updateError } = await serviceClient
    .from('companies')
    .update({ status })
    .eq('id', companyId)

  if (updateError) {
    console.error('[admin] Failed to update tenant status:', updateError)
    return { error: 'Status konnte nicht aktualisiert werden.' }
  }

  await writeAuditLog({
    companyId,
    actorId: holdingSession.session.profile.id,
    action: 'tenant.status_changed',
    tableName: 'tenants',
    recordId: companyId,
    oldValues: { status: tenant['status'] as string },
    newValues: { status },
  })

  revalidatePath(`/admin/tenants/${tenant['slug'] as string}`)
  revalidatePath('/admin')
  return {}
}
