'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { writeAuditLog } from '@/lib/audit'
import { generateTemporaryPassword } from '@/lib/password'
import { getSession } from '@/lib/session'

type CreateTenantInput = {
  name: string
  slug: string
  branding: {
    primary: string
    secondary: string
    accent: string
    font: string
    radius: string
  }
  superUser: {
    firstName: string
    lastName: string
    email: string
  }
}

const SLUG_REGEX = /^[a-z0-9-]+$/
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

function validateInput(data: CreateTenantInput): string | null {
  if (!data.name || data.name.length < 2 || data.name.length > 100) {
    return 'Der Unternehmensname muss zwischen 2 und 100 Zeichen lang sein.'
  }
  if (!data.slug || data.slug.length < 2 || data.slug.length > 50 || !SLUG_REGEX.test(data.slug)) {
    return 'Der Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten (2-50 Zeichen).'
  }
  if (!HEX_COLOR_REGEX.test(data.branding.primary)) {
    return 'Ungueltige Primaerfarbe. Bitte geben Sie einen gueltigen Hex-Farbwert ein.'
  }
  if (!HEX_COLOR_REGEX.test(data.branding.secondary)) {
    return 'Ungueltige Sekundaerfarbe. Bitte geben Sie einen gueltigen Hex-Farbwert ein.'
  }
  if (!HEX_COLOR_REGEX.test(data.branding.accent)) {
    return 'Ungueltige Akzentfarbe. Bitte geben Sie einen gueltigen Hex-Farbwert ein.'
  }
  if (!data.branding.font || data.branding.font.length < 1) {
    return 'Bitte geben Sie eine Schriftart an.'
  }
  if (!data.superUser.firstName || data.superUser.firstName.length < 1) {
    return 'Bitte geben Sie den Vornamen des Super Users ein.'
  }
  if (!data.superUser.lastName || data.superUser.lastName.length < 1) {
    return 'Bitte geben Sie den Nachnamen des Super Users ein.'
  }
  if (!data.superUser.email || !data.superUser.email.includes('@')) {
    return 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.'
  }
  return null
}

export async function createTenantAction(data: CreateTenantInput): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
    return { error: 'Nicht autorisiert.' }
  }

  const validationError = validateInput(data)
  if (validationError) {
    return { error: validationError }
  }

  const serviceClient = createSupabaseServiceClient()

  // 1. Check slug uniqueness
  const { data: existing } = await serviceClient
    .from('companies')
    .select('id')
    .eq('slug', data.slug)
    .maybeSingle()

  if (existing) {
    return { error: 'Dieser Slug ist bereits vergeben.' }
  }

  // 2. Create tenant
  const { data: tenant, error: tenantError } = await serviceClient
    .from('companies')
    .insert({
      name: data.name,
      slug: data.slug,
      created_by: session.profile.id,
    })
    .select()
    .single()

  if (tenantError || !tenant) {
    console.error('[admin] Failed to create tenant:', tenantError)
    return { error: 'Unternehmen konnte nicht erstellt werden.' }
  }

  // 3. Upsert branding (the DB trigger may auto-create a default row)
  const { error: brandingError } = await serviceClient
    .from('company_branding')
    .upsert(
      {
        company_id: tenant.id,
        primary_color: data.branding.primary,
        secondary_color: data.branding.secondary,
        accent_color: data.branding.accent,
        font_family: data.branding.font,
        border_radius: data.branding.radius,
      },
      { onConflict: 'company_id' },
    )

  if (brandingError) {
    console.error('[admin] Failed to set branding:', brandingError)
    // Non-fatal -- tenant is created, branding can be fixed later
  }

  // 4. Create super user auth account
  const tempPassword = generateTemporaryPassword()
  const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
    email: data.superUser.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { company_id: tenant.id },
  })

  if (authError || !authUser.user) {
    console.error('[admin] Failed to create auth user:', authError)
    return { error: 'Super User konnte nicht erstellt werden: ' + (authError?.message ?? 'Unbekannter Fehler') }
  }

  // 5. Create profile
  const { error: profileError } = await serviceClient.from('profiles').insert({
    id: authUser.user.id,
    company_id: tenant.id,
    first_name: data.superUser.firstName,
    last_name: data.superUser.lastName,
    must_reset_password: true,
    totp_enabled: false,
  })

  if (profileError) {
    console.error('[admin] Failed to create profile:', profileError)
    // Attempt cleanup of auth user
    await serviceClient.auth.admin.deleteUser(authUser.user.id)
    return { error: 'Profil konnte nicht erstellt werden.' }
  }

  // 6. Assign super_user role
  const { data: superRole } = await serviceClient
    .from('roles')
    .select('id')
    .eq('company_id', tenant.id)
    .eq('key', 'super_user')
    .single()

  if (superRole) {
    await serviceClient.from('profile_roles').insert({
      profile_id: authUser.user.id,
      role_id: superRole.id,
    })
  } else {
    // If the trigger didn't create default roles, create the super_user role manually
    const { data: newRole } = await serviceClient
      .from('roles')
      .insert({
        company_id: tenant.id,
        key: 'super_user',
        label: 'Super User',
        description: 'Vollzugriff auf alle Mandantenfunktionen',
        is_system: true,
      })
      .select()
      .single()

    if (newRole) {
      await serviceClient.from('profile_roles').insert({
        profile_id: authUser.user.id,
        role_id: newRole.id,
      })
    }
  }

  // 7. Log temp password in development (replace with email sending in production)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Super user invite: ${data.superUser.email} / ${tempPassword}`)
  }

  // 8. Audit log
  await writeAuditLog({
    companyId: tenant.id,
    actorId: session.profile.id,
    action: 'tenant.created',
    tableName: 'tenants',
    recordId: tenant.id,
    newValues: { name: data.name, slug: data.slug, superUserEmail: data.superUser.email },
  })

  redirect(`/admin/tenants/${data.slug}`)
}
