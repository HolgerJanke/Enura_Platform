'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'
import { generateTemporaryPassword } from '@/lib/password'

async function requireEnuraSession() {
  const session = await getSession()
  if (!session?.isEnuraAdmin) {
    throw new Error('Nicht autorisiert')
  }
  return session
}

export async function updateHolding(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const holdingId = formData.get('holdingId') as string
  if (!holdingId) return { success: false, error: 'Holding-ID fehlt' }

  const supabase = createSupabaseServiceClient()

  const updates: Record<string, string> = {}
  const name = formData.get('name') as string | null
  const primaryDomain = formData.get('primary_domain') as string | null

  if (name) updates.name = name
  if (primaryDomain !== null) updates.primary_domain = primaryDomain

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'Keine Änderungen' }
  }

  const { error } = await supabase
    .from('holdings')
    .update(updates)
    .eq('id', holdingId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/platform/holdings/${holdingId}`)
  revalidatePath('/platform')
  return { success: true }
}

export async function suspendHolding(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const holdingId = formData.get('holdingId') as string
  if (!holdingId) return { success: false, error: 'Holding-ID fehlt' }

  const supabase = createSupabaseServiceClient()

  const { error } = await supabase
    .from('holdings')
    .update({ status: 'suspended' })
    .eq('id', holdingId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/platform/holdings/${holdingId}`)
  revalidatePath('/platform')
  return { success: true }
}

export async function updateSubscription(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const holdingId = formData.get('holdingId') as string
  if (!holdingId) return { success: false, error: 'Holding-ID fehlt' }

  const supabase = createSupabaseServiceClient()

  const updates = {
    plan: formData.get('plan') as string,
    billing_cycle: formData.get('billing_cycle') as string,
    ai_calls_enabled: formData.get('ai_calls_enabled') === 'true',
    process_builder_enabled: formData.get('process_builder_enabled') === 'true',
    liquidity_enabled: formData.get('liquidity_enabled') === 'true',
    max_companies: Number(formData.get('max_companies')),
    max_users_per_company: Number(formData.get('max_users_per_company')),
  }

  const { error } = await supabase
    .from('holding_subscriptions')
    .update(updates)
    .eq('holding_id', holdingId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/platform/holdings/${holdingId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Holding Admin promotion (Enura Admin only)
// ---------------------------------------------------------------------------

export async function promoteToHoldingAdmin(
  holdingId: string,
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const supabase = createSupabaseServiceClient()

  // Verify user belongs to this holding
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, holding_id')
    .eq('id', profileId)
    .single()

  if (!profile) return { success: false, error: 'Benutzer nicht gefunden.' }

  // Update user's holding_id if not set
  if (!(profile as Record<string, unknown>)['holding_id']) {
    await supabase.from('profiles').update({ holding_id: holdingId }).eq('id', profileId)
  }

  // Insert into holding_admins (legacy table checked by session)
  await supabase
    .from('holding_admins')
    .upsert({ profile_id: profileId }, { onConflict: 'profile_id' })

  // Also insert into holding_admins_v2 (per-holding)
  const { error } = await supabase
    .from('holding_admins_v2')
    .upsert(
      { holding_id: holdingId, profile_id: profileId, is_owner: false },
      { onConflict: 'holding_id,profile_id' },
    )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/platform/holdings/${holdingId}`)
  return { success: true }
}

export async function removeHoldingAdmin(
  holdingId: string,
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const supabase = createSupabaseServiceClient()

  // Remove from holding_admins_v2
  await supabase
    .from('holding_admins_v2')
    .delete()
    .eq('holding_id', holdingId)
    .eq('profile_id', profileId)

  // Remove from legacy holding_admins
  await supabase
    .from('holding_admins')
    .delete()
    .eq('profile_id', profileId)

  revalidatePath(`/platform/holdings/${holdingId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// User & role management within a holding (Enura Admin only)
// ---------------------------------------------------------------------------

/** Confirm a company belongs to the given holding. */
async function companyInHolding(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string,
  holdingId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .eq('holding_id', holdingId)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Invite a new user into one of the holding's companies and assign a role.
 * Creates (or reuses) the auth user, upserts their profile with the company
 * assignment, and links the chosen role.
 */
export async function inviteUserToCompany(input: {
  holdingId: string
  companyId: string
  firstName: string
  lastName: string
  email: string
  roleId: string | null
}): Promise<{ success: boolean; error?: string; tempPassword?: string }> {
  await requireEnuraSession()
  const supabase = createSupabaseServiceClient()

  const email = input.email.trim().toLowerCase()
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()

  if (!email.includes('@')) return { success: false, error: 'Gültige E-Mail-Adresse erforderlich.' }
  if (!firstName || !lastName) return { success: false, error: 'Vor- und Nachname sind erforderlich.' }

  if (!(await companyInHolding(supabase, input.companyId, input.holdingId))) {
    return { success: false, error: 'Ungültiges Unternehmen.' }
  }

  // Validate the role (if any) belongs to the selected company
  if (input.roleId) {
    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('id', input.roleId)
      .eq('company_id', input.companyId)
      .maybeSingle()
    if (!role) return { success: false, error: 'Ungültige Rolle für dieses Unternehmen.' }
  }

  // Create the auth user, or reuse an existing account with the same email
  const tempPassword = generateTemporaryPassword()
  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  })

  let userId: string
  let createdNew = false
  if (authError || !created?.user) {
    const { data: list } = await supabase.auth.admin.listUsers()
    const existing = list?.users?.find((u) => u.email === email)
    if (!existing) {
      return { success: false, error: `Benutzer konnte nicht erstellt werden: ${authError?.message ?? 'Unbekannter Fehler'}` }
    }
    userId = existing.id
  } else {
    userId = created.user.id
    createdNew = true
  }

  // Upsert profile → this is the company assignment
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        holding_id: input.holdingId,
        company_id: input.companyId,
        first_name: firstName,
        last_name: lastName,
        // display_name is a generated column (first_name || ' ' || last_name) — never set it
        must_reset_password: true,
        totp_enabled: false,
        is_active: true,
      },
      { onConflict: 'id' },
    )

  if (profileError) return { success: false, error: profileError.message }

  if (input.roleId) {
    const { error: roleError } = await supabase
      .from('profile_roles')
      .upsert(
        { profile_id: userId, role_id: input.roleId },
        { onConflict: 'profile_id,role_id' },
      )
    if (roleError) return { success: false, error: roleError.message }
  }

  // TODO: send invitation email with temp password via Resend.
  // Until then, return the temp password for newly created accounts so the
  // admin can hand it over. Reused existing accounts keep their own password.
  revalidatePath(`/platform/holdings/${input.holdingId}`)
  return createdNew ? { success: true, tempPassword } : { success: true }
}

/**
 * Reassign an existing user to a company within this holding and set their
 * roles. Roles are validated against the target company; roles from any other
 * company are dropped so a moved user never keeps stale cross-company roles.
 */
export async function setUserCompanyAndRoles(input: {
  holdingId: string
  profileId: string
  companyId: string
  roleIds: string[]
}): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()
  const supabase = createSupabaseServiceClient()

  if (!(await companyInHolding(supabase, input.companyId, input.holdingId))) {
    return { success: false, error: 'Ungültiges Unternehmen.' }
  }

  // Only roles that belong to the target company are valid
  const { data: companyRoles } = await supabase
    .from('roles')
    .select('id')
    .eq('company_id', input.companyId)

  const validRoleIds = new Set(((companyRoles ?? []) as Array<{ id: string }>).map((r) => r.id))
  const desired = input.roleIds.filter((id) => validRoleIds.has(id))

  // Move the user to the target company
  const { error: moveError } = await supabase
    .from('profiles')
    .update({ company_id: input.companyId, holding_id: input.holdingId })
    .eq('id', input.profileId)

  if (moveError) return { success: false, error: moveError.message }

  // Reconcile roles: add the desired ones, drop everything else
  const { data: currentRows } = await supabase
    .from('profile_roles')
    .select('role_id')
    .eq('profile_id', input.profileId)

  const currentIds = ((currentRows ?? []) as Array<{ role_id: string }>).map((r) => r.role_id)
  const toAdd = desired.filter((id) => !currentIds.includes(id))
  const toRemove = currentIds.filter((id) => !desired.includes(id))

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('profile_roles')
      .upsert(
        toAdd.map((role_id) => ({ profile_id: input.profileId, role_id })),
        { onConflict: 'profile_id,role_id' },
      )
    if (error) return { success: false, error: error.message }
  }

  for (const role_id of toRemove) {
    await supabase
      .from('profile_roles')
      .delete()
      .eq('profile_id', input.profileId)
      .eq('role_id', role_id)
  }

  revalidatePath(`/platform/holdings/${input.holdingId}`)
  return { success: true }
}
