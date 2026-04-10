'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { getSession } from '@/lib/session'
import type { TenantStatus } from '@enura/types'

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

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
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
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

  // Verify tenant exists
  const { data: tenant } = await serviceClient
    .from('companies')
    .select('id, slug')
    .eq('id', companyId)
    .single()

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
    actorId: session.profile.id,
    action: 'tenant_branding.updated',
    tableName: 'tenant_brandings',
    recordId: companyId,
    oldValues: currentBranding ? { ...currentBranding } : undefined,
    newValues: { ...branding },
  })

  revalidatePath(`/admin/tenants/${tenant.slug}`)
  return {}
}

export async function updateTenantStatusAction(
  companyId: string,
  status: TenantStatus,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
    return { error: 'Nicht autorisiert.' }
  }

  const validStatuses: TenantStatus[] = ['active', 'suspended', 'archived']
  if (!validStatuses.includes(status)) {
    return { error: 'Ungültiger Status.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Fetch current tenant for audit log
  const { data: tenant } = await serviceClient
    .from('companies')
    .select('id, slug, status')
    .eq('id', companyId)
    .single()

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
    actorId: session.profile.id,
    action: 'tenant.status_changed',
    tableName: 'tenants',
    recordId: companyId,
    oldValues: { status: tenant.status },
    newValues: { status },
  })

  revalidatePath(`/admin/tenants/${tenant.slug}`)
  revalidatePath('/admin')
  return {}
}
