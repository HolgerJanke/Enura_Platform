'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/audit'
import { generateTemporaryPassword } from '@/lib/password'

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

export type UserWithCompany = {
  id: string
  firstName: string | null
  lastName: string | null
  displayName: string
  email: string
  isActive: boolean
  mustResetPassword: boolean
  totpEnabled: boolean
  lastSignInAt: string | null
  createdAt: string
  companyId: string | null
  companyName: string | null
  roles: string[]
}

export type PendingInvitation = {
  id: string
  email: string
  companyId: string
  companyName: string
  roleKey: string
  roleLabel: string
  invitedAt: string
  expiresAt: string
  invitedByName: string
}

export type CompanyOption = {
  id: string
  name: string
}

export type RoleOption = {
  id: string
  key: string
  label: string
}

// ---------------------------------------------------------------------------
// getAllUsers — fetch all users across all companies in the holding
// ---------------------------------------------------------------------------

export async function getAllUsers(): Promise<{
  users: UserWithCompany[]
  invitations: PendingInvitation[]
  companies: CompanyOption[]
  roles: RoleOption[]
}> {
  const { holdingId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Fetch companies in this holding
  const { data: companiesRaw } = await supabase
    .from('companies')
    .select('id, name')
    .eq('holding_id', holdingId)
    .eq('status', 'active')
    .order('name')

  const companies = (companiesRaw ?? []) as CompanyOption[]
  const companyIds = companies.map((c) => c.id)
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))

  // Fetch profiles belonging to these companies
  let users: UserWithCompany[] = []
  if (companyIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select(`
        id, first_name, last_name, display_name, is_active,
        must_reset_password, totp_enabled, last_sign_in_at, created_at,
        company_id,
        profile_roles (
          role_id,
          roles ( key, label )
        )
      `)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })

    type ProfileRaw = {
      id: string
      first_name: string | null
      last_name: string | null
      display_name: string
      is_active: boolean
      must_reset_password: boolean
      totp_enabled: boolean
      last_sign_in_at: string | null
      created_at: string
      company_id: string | null
      profile_roles: Array<{
        role_id: string
        roles: { key: string; label: string } | null
      }>
    }

    const profiles = (profilesRaw ?? []) as unknown as ProfileRaw[]

    users = profiles.map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      displayName: p.display_name,
      email: p.display_name, // display_name often holds email; auth email not directly accessible
      isActive: p.is_active,
      mustResetPassword: p.must_reset_password,
      totpEnabled: p.totp_enabled,
      lastSignInAt: p.last_sign_in_at,
      createdAt: p.created_at,
      companyId: p.company_id,
      companyName: p.company_id ? (companyMap.get(p.company_id) ?? null) : null,
      roles: p.profile_roles
        ?.map((pr) => pr.roles?.label)
        .filter((r): r is string => Boolean(r)) ?? [],
    }))
  }

  // Fetch pending invitations
  let invitations: PendingInvitation[] = []
  if (companyIds.length > 0) {
    const { data: invRaw } = await supabase
      .from('user_invitations')
      .select(`
        id, email, company_id, role_key, role_label,
        invited_at, expires_at, invited_by,
        profiles:invited_by ( display_name )
      `)
      .in('company_id', companyIds)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })

    type InvRaw = {
      id: string
      email: string
      company_id: string
      role_key: string
      role_label: string
      invited_at: string
      expires_at: string
      invited_by: string
      profiles: { display_name: string } | null
    }

    const invs = (invRaw ?? []) as unknown as InvRaw[]
    invitations = invs.map((inv) => ({
      id: inv.id,
      email: inv.email,
      companyId: inv.company_id,
      companyName: companyMap.get(inv.company_id) ?? 'Unbekannt',
      roleKey: inv.role_key,
      roleLabel: inv.role_label,
      invitedAt: inv.invited_at,
      expiresAt: inv.expires_at,
      invitedByName: inv.profiles?.display_name ?? 'Unbekannt',
    }))
  }

  // Fetch available roles (system roles)
  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id, key, label')
    .eq('is_system', true)
    .order('label')

  const roles = (rolesRaw ?? []) as RoleOption[]

  return { users, invitations, companies, roles }
}

// ---------------------------------------------------------------------------
// inviteUser — create invitation and send email
// ---------------------------------------------------------------------------

export async function inviteUser(data: {
  companyId: string
  email: string
  roleKey: string
  roleLabel: string
  firstName: string
  lastName: string
}): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()
  const serviceClient = createSupabaseServiceClient()

  // Validate company belongs to holding
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', data.companyId)
    .eq('holding_id', holdingId)
    .single()

  if (!company) {
    return { success: false, error: 'Ungueltiges Unternehmen.' }
  }

  if (!data.email || !data.email.includes('@')) {
    return { success: false, error: 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.' }
  }

  // Check if user already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('display_name', data.email)
    .eq('company_id', data.companyId)
    .maybeSingle()

  if (existingProfile) {
    return { success: false, error: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits in diesem Unternehmen.' }
  }

  // Create auth user with temp password
  const tempPassword = generateTemporaryPassword()
  const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { company_id: data.companyId },
  })

  if (authError || !authUser.user) {
    return { success: false, error: `Benutzer konnte nicht erstellt werden: ${authError?.message ?? 'Unbekannter Fehler'}` }
  }

  // Create profile
  const { error: profileError } = await serviceClient.from('profiles').insert({
    id: authUser.user.id,
    company_id: data.companyId,
    holding_id: holdingId,
    first_name: data.firstName,
    last_name: data.lastName,
    display_name: data.email,
    must_reset_password: true,
    totp_enabled: false,
  })

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: `Profil konnte nicht erstellt werden: ${profileError.message}` }
  }

  // Assign role
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('key', data.roleKey)
    .maybeSingle()

  if (role) {
    await serviceClient.from('profile_roles').insert({
      profile_id: authUser.user.id,
      role_id: role.id,
    })
  }

  // Create invitation record
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await supabase.from('user_invitations').insert({
    email: data.email,
    company_id: data.companyId,
    role_key: data.roleKey,
    role_label: data.roleLabel,
    invited_by: userId,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
    profile_id: authUser.user.id,
  })

  // Log temp password in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] User invite: ${data.email} / ${tempPassword}`)
  }

  await writeAuditLog({
    companyId: data.companyId,
    actorId: userId,
    action: 'user.invited',
    tableName: 'profiles',
    recordId: authUser.user.id,
    newValues: { email: data.email, role: data.roleKey, company: company.name },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// deactivateUser
// ---------------------------------------------------------------------------

export async function deactivateUser(
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', profileId)

  if (error) {
    return { success: false, error: `Fehler beim Deaktivieren: ${error.message}` }
  }

  await writeAuditLog({
    companyId: null,
    actorId: userId,
    action: 'user.deactivated',
    tableName: 'profiles',
    recordId: profileId,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// reactivateUser
// ---------------------------------------------------------------------------

export async function reactivateUser(
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: true })
    .eq('id', profileId)

  if (error) {
    return { success: false, error: `Fehler beim Reaktivieren: ${error.message}` }
  }

  await writeAuditLog({
    companyId: null,
    actorId: userId,
    action: 'user.reactivated',
    tableName: 'profiles',
    recordId: profileId,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// resetUser2fa
// ---------------------------------------------------------------------------

export async function resetUser2fa(
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      totp_enabled: false,
      totp_enrolled_at: null,
    })
    .eq('id', profileId)

  if (error) {
    return { success: false, error: `Fehler beim Zuruecksetzen der 2FA: ${error.message}` }
  }

  await writeAuditLog({
    companyId: null,
    actorId: userId,
    action: 'user.2fa_reset',
    tableName: 'profiles',
    recordId: profileId,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// resendInvitation
// ---------------------------------------------------------------------------

export async function resendInvitation(
  invitationId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const newExpiry = new Date()
  newExpiry.setDate(newExpiry.getDate() + 7)

  const { error } = await supabase
    .from('user_invitations')
    .update({
      expires_at: newExpiry.toISOString(),
      invited_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .eq('status', 'pending')

  if (error) {
    return { success: false, error: `Fehler beim erneuten Senden: ${error.message}` }
  }

  // TODO: send actual email via Resend when configured

  await writeAuditLog({
    companyId: null,
    actorId: userId,
    action: 'invitation.resent',
    tableName: 'user_invitations',
    recordId: invitationId,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// revokeInvitation
// ---------------------------------------------------------------------------

export async function revokeInvitation(
  invitationId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('status', 'pending')

  if (error) {
    return { success: false, error: `Fehler beim Widerrufen: ${error.message}` }
  }

  await writeAuditLog({
    companyId: null,
    actorId: userId,
    action: 'invitation.revoked',
    tableName: 'user_invitations',
    recordId: invitationId,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Promote to Super User for a company
// ---------------------------------------------------------------------------

export async function promoteToCompanySuperUser(
  companyId: string,
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('company_id', companyId)
    .eq('key', 'super_user')
    .single()

  if (!role) return { success: false, error: 'Super-User-Rolle nicht gefunden.' }

  const { error } = await supabase
    .from('profile_roles')
    .upsert(
      { profile_id: profileId, role_id: (role as { id: string }).id },
      { onConflict: 'profile_id,role_id' },
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Remove Super User role
// ---------------------------------------------------------------------------

export async function removeCompanySuperUser(
  companyId: string,
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('company_id', companyId)
    .eq('key', 'super_user')
    .single()

  if (!role) return { success: false, error: 'Rolle nicht gefunden.' }

  const { error } = await supabase
    .from('profile_roles')
    .delete()
    .eq('profile_id', profileId)
    .eq('role_id', (role as { id: string }).id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Promote to Holding Admin (peer promotion)
// ---------------------------------------------------------------------------

export async function promoteToHoldingAdminFromHolding(
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  await supabase
    .from('holding_admins')
    .upsert({ profile_id: profileId }, { onConflict: 'profile_id' })

  const { error } = await supabase
    .from('holding_admins_v2')
    .upsert(
      { holding_id: session.holdingId ?? '', profile_id: profileId, is_owner: false },
      { onConflict: 'holding_id,profile_id' },
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Update user roles from holding admin (cross-company)
// ---------------------------------------------------------------------------

export async function updateUserRolesFromHolding(
  profileId: string,
  companyId: string,
  roleIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const session = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Verify company belongs to this holding
  const { data: company } = await supabase
    .from('companies')
    .select('id, holding_id')
    .eq('id', companyId)
    .single()

  if (!company || (company as Record<string, unknown>)['holding_id'] !== session.holdingId) {
    return { success: false, error: 'Unternehmen gehoert nicht zu dieser Holding.' }
  }

  // Get all roles for this company to validate roleIds
  const { data: companyRoles } = await supabase
    .from('roles')
    .select('id')
    .eq('company_id', companyId)

  const validRoleIds = new Set((companyRoles ?? []).map((r) => (r as { id: string }).id))
  const filteredRoleIds = roleIds.filter((id) => validRoleIds.has(id))

  // Get current roles for this user in this company
  const { data: currentRoles } = await supabase
    .from('profile_roles')
    .select('role_id')
    .eq('profile_id', profileId)

  const currentRoleIds = new Set(
    ((currentRoles ?? []) as Array<{ role_id: string }>)
      .map((r) => r.role_id)
      .filter((id) => validRoleIds.has(id)),
  )

  const toAdd = filteredRoleIds.filter((id) => !currentRoleIds.has(id))
  const toRemove = [...currentRoleIds].filter((id) => !filteredRoleIds.includes(id))

  if (toAdd.length > 0) {
    await supabase
      .from('profile_roles')
      .upsert(
        toAdd.map((roleId) => ({ profile_id: profileId, role_id: roleId })),
        { onConflict: 'profile_id,role_id' },
      )
  }

  for (const roleId of toRemove) {
    await supabase
      .from('profile_roles')
      .delete()
      .eq('profile_id', profileId)
      .eq('role_id', roleId)
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function getCompanyRoles(
  companyId: string,
): Promise<Array<{ id: string; key: string; label: string; description: string | null }>> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { data } = await supabase
    .from('roles')
    .select('id, key, label, description')
    .eq('company_id', companyId)
    .eq('is_system', true)
    .order('label')

  return (data ?? []) as Array<{ id: string; key: string; label: string; description: string | null }>
}
