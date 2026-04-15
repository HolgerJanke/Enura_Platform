'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'
import { writeAuditLog } from '@/lib/audit'
import { generateTemporaryPassword } from '@/lib/password'
import { CreateUserSchema } from '@enura/types'

export async function createUserAction(data: {
  firstName: string
  lastName: string
  email: string
  roleIds: string[]
}): Promise<{ error?: string; success?: boolean; tempPassword?: string }> {
  const session = await getSession()
  if (!session || !session.companyId) return { error: 'Nicht autorisiert' }

  const parsed = CreateUserSchema.safeParse({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    roleIds: data.roleIds,
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Ungültige Eingabe' }
  }

  const serviceClient = createSupabaseServiceClient()

  const tempPassword = generateTemporaryPassword()

  const { data: authUser, error: authError } =
    await serviceClient.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { company_id: session.companyId },
    })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return { error: 'Diese E-Mail-Adresse ist bereits registriert.' }
    }
    return { error: 'Benutzer konnte nicht erstellt werden.' }
  }

  if (!authUser.user) return { error: 'Benutzer konnte nicht erstellt werden.' }

  // Create profile
  await serviceClient.from('profiles').insert({
    id: authUser.user.id,
    company_id: session.companyId,
    first_name: data.firstName,
    last_name: data.lastName,
    must_reset_password: true,
    totp_enabled: false,
  })

  // Assign roles
  for (const roleId of data.roleIds) {
    await serviceClient.from('profile_roles').insert({
      profile_id: authUser.user.id,
      role_id: roleId,
    })
  }

  await writeAuditLog({
    companyId: session.companyId,
    actorId: session.profile.id,
    action: 'user.created',
    tableName: 'profiles',
    recordId: authUser.user.id,
    newValues: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
    },
  })

  return { success: true, tempPassword }
}

export async function updateUserRolesAction(
  userId: string,
  roleIds: string[]
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.companyId) return { error: 'Nicht autorisiert' }

  const serviceClient = createSupabaseServiceClient()

  // Verify user belongs to same tenant
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, company_id')
    .eq('id', userId)
    .single()

  if (!profile || profile.company_id !== session.companyId) {
    return { error: 'Benutzer nicht gefunden.' }
  }

  // Get current roles
  const { data: currentRoles } = await serviceClient
    .from('profile_roles')
    .select('id, role_id')
    .eq('profile_id', userId)

  const currentRoleIds = (currentRoles ?? []).map((r) => r.role_id)
  const toAdd = roleIds.filter((id) => !currentRoleIds.includes(id))
  const toRemove = (currentRoles ?? []).filter(
    (r) => !roleIds.includes(r.role_id)
  )

  // Add new roles
  for (const roleId of toAdd) {
    await serviceClient.from('profile_roles').insert({
      profile_id: userId,
      role_id: roleId,
    })
    await writeAuditLog({
      companyId: session.companyId,
      actorId: session.profile.id,
      action: 'role.assigned',
      tableName: 'profile_roles',
      recordId: userId,
      newValues: { role_id: roleId },
    })
  }

  // Remove old roles
  for (const pr of toRemove) {
    await serviceClient.from('profile_roles').delete().eq('id', pr.id)
    await writeAuditLog({
      companyId: session.companyId,
      actorId: session.profile.id,
      action: 'role.revoked',
      tableName: 'profile_roles',
      recordId: userId,
      oldValues: { role_id: pr.role_id },
    })
  }

  return { success: true }
}

export async function resetUserPasswordAction(
  userId: string
): Promise<{ error?: string; success?: boolean; tempPassword?: string }> {
  const session = await getSession()
  if (!session || !session.companyId) return { error: 'Nicht autorisiert' }

  const serviceClient = createSupabaseServiceClient()

  // Verify user belongs to same tenant
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, company_id')
    .eq('id', userId)
    .single()

  if (!profile || profile.company_id !== session.companyId) {
    return { error: 'Benutzer nicht gefunden.' }
  }

  const tempPassword = generateTemporaryPassword()

  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    password: tempPassword,
  })

  if (error) return { error: 'Passwort konnte nicht zurückgesetzt werden.' }

  // Mark user as needing password reset and re-enrol 2FA
  await serviceClient
    .from('profiles')
    .update({
      must_reset_password: true,
      totp_enabled: false,
    })
    .eq('id', userId)

  await writeAuditLog({
    companyId: session.companyId,
    actorId: session.profile.id,
    action: 'auth.password_reset_by_admin',
    tableName: 'profiles',
    recordId: userId,
  })

  return { success: true, tempPassword }
}

export async function toggleUserActiveAction(
  userId: string,
  active: boolean
): Promise<{ error?: string; success?: boolean; tempPassword?: string }> {
  const session = await getSession()
  if (!session || !session.companyId) return { error: 'Nicht autorisiert' }

  // Cannot deactivate yourself
  if (userId === session.profile.id) {
    return { error: 'Sie können sich nicht selbst deaktivieren.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // When reactivating: force password reset on next login
  const updateData: Record<string, unknown> = { is_active: active }
  if (active) {
    updateData['must_reset_password'] = true
  }

  const { error } = await serviceClient
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .eq('company_id', session.companyId)

  if (error) return { error: 'Status konnte nicht geändert werden.' }

  // If reactivating, also reset their Supabase Auth password to a temp one
  let tempPassword: string | undefined
  if (active) {
    tempPassword = generateTemporaryPassword()
    await serviceClient.auth.admin.updateUserById(userId, { password: tempPassword })
  }

  await writeAuditLog({
    companyId: session.companyId,
    actorId: session.profile.id,
    action: active ? 'user.reactivated' : 'user.deactivated',
    tableName: 'profiles',
    recordId: userId,
    newValues: { is_active: active, must_reset_password: active ? true : undefined },
  })

  return { success: true, tempPassword }
}

// ---------------------------------------------------------------------------
// Update user profile
// ---------------------------------------------------------------------------

export async function updateUserProfileAction(
  userId: string,
  data: { firstName: string; lastName: string; phone: string | null }
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.companyId) return { error: 'Nicht autorisiert' }

  const serviceClient = createSupabaseServiceClient()

  // Verify user belongs to same company
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, company_id')
    .eq('id', userId)
    .single()

  const profileRow = profile as { id: string; company_id: string | null } | null
  if (!profileRow || profileRow.company_id !== session.companyId) {
    return { error: 'Benutzer nicht gefunden.' }
  }

  // Note: display_name is a GENERATED column (first_name || ' ' || last_name) — do not set it
  const { error } = await serviceClient
    .from('profiles')
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
    })
    .eq('id', userId)
    .eq('company_id', session.companyId)

  if (error) return { error: `Profil konnte nicht aktualisiert werden: ${error.message}` }

  await writeAuditLog({
    companyId: session.companyId,
    actorId: session.profile.id,
    action: 'user.profile_updated',
    tableName: 'profiles',
    recordId: userId,
    newValues: { firstName: data.firstName, lastName: data.lastName, phone: data.phone },
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// Delete user
// ---------------------------------------------------------------------------

export async function deleteUserAction(
  userId: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.companyId) return { error: 'Nicht autorisiert' }

  if (userId === session.profile.id) {
    return { error: 'Sie koennen sich nicht selbst loeschen.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Verify user belongs to same company and is inactive
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, company_id, is_active, first_name, last_name')
    .eq('id', userId)
    .single()

  if (!profile || profile.company_id !== session.companyId) {
    return { error: 'Benutzer nicht gefunden.' }
  }

  if (profile.is_active) {
    return { error: 'Aktive Benutzer koennen nicht geloescht werden. Bitte zuerst deaktivieren.' }
  }

  // Remove role assignments
  await serviceClient.from('profile_roles').delete().eq('profile_id', userId)

  // Delete profile
  await serviceClient.from('profiles').delete().eq('id', userId)

  // Delete auth user
  await serviceClient.auth.admin.deleteUser(userId)

  await writeAuditLog({
    companyId: session.companyId,
    actorId: session.profile.id,
    action: 'user.deleted',
    tableName: 'profiles',
    recordId: userId,
    oldValues: {
      name: `${profile.first_name} ${profile.last_name}`,
    },
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// Toggle 2FA requirement for company
// ---------------------------------------------------------------------------

export async function toggleRequire2faAction(
  require2fa: boolean
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.companyId) return { error: 'Nicht autorisiert' }

  // Only super_user / admin:write can change this
  const hasPermission = session.permissions.includes('module:admin:write') || session.isHoldingAdmin
  if (!hasPermission) return { error: 'Keine Berechtigung.' }

  const serviceClient = createSupabaseServiceClient()

  const { error } = await serviceClient
    .from('company_settings')
    .update({ require_2fa: require2fa })
    .eq('company_id', session.companyId)

  if (error) return { error: 'Einstellung konnte nicht geaendert werden.' }

  await writeAuditLog({
    companyId: session.companyId,
    actorId: session.profile.id,
    action: 'company.2fa_policy_changed',
    tableName: 'company_settings',
    recordId: session.companyId,
    newValues: { require_2fa: require2fa },
  })

  return { success: true }
}
