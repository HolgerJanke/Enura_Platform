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
}): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.tenantId) return { error: 'Nicht autorisiert' }

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
      user_metadata: { tenant_id: session.tenantId },
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
    tenant_id: session.tenantId,
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

  // Log temp password in dev (in production, send email via Resend)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] New user: ${data.email} / ${tempPassword}`)
  }

  await writeAuditLog({
    tenantId: session.tenantId,
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

  return { success: true }
}

export async function updateUserRolesAction(
  userId: string,
  roleIds: string[]
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.tenantId) return { error: 'Nicht autorisiert' }

  const serviceClient = createSupabaseServiceClient()

  // Verify user belongs to same tenant
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, tenant_id')
    .eq('id', userId)
    .single()

  if (!profile || profile.tenant_id !== session.tenantId) {
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
      tenantId: session.tenantId,
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
      tenantId: session.tenantId,
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
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.tenantId) return { error: 'Nicht autorisiert' }

  const serviceClient = createSupabaseServiceClient()

  // Verify user belongs to same tenant
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, tenant_id')
    .eq('id', userId)
    .single()

  if (!profile || profile.tenant_id !== session.tenantId) {
    return { error: 'Benutzer nicht gefunden.' }
  }

  const tempPassword = generateTemporaryPassword()

  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    password: tempPassword,
  })

  if (error) return { error: 'Passwort konnte nicht zurueckgesetzt werden.' }

  // Mark user as needing password reset and re-enrol 2FA
  await serviceClient
    .from('profiles')
    .update({
      must_reset_password: true,
      totp_enabled: false,
    })
    .eq('id', userId)

  // Log in dev (in production, send email via Resend)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Password reset for ${userId}: ${tempPassword}`)
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    actorId: session.profile.id,
    action: 'auth.password_reset_by_admin',
    tableName: 'profiles',
    recordId: userId,
  })

  return { success: true }
}

export async function toggleUserActiveAction(
  userId: string,
  active: boolean
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session || !session.tenantId) return { error: 'Nicht autorisiert' }

  // Cannot deactivate yourself
  if (userId === session.profile.id) {
    return { error: 'Sie können sich nicht selbst deaktivieren.' }
  }

  const serviceClient = createSupabaseServiceClient()

  const { error } = await serviceClient
    .from('profiles')
    .update({ is_active: active })
    .eq('id', userId)
    .eq('tenant_id', session.tenantId)

  if (error) return { error: 'Status konnte nicht geaendert werden.' }

  await writeAuditLog({
    tenantId: session.tenantId,
    actorId: session.profile.id,
    action: active ? 'user.reactivated' : 'user.deactivated',
    tableName: 'profiles',
    recordId: userId,
    newValues: { is_active: active },
  })

  return { success: true }
}
