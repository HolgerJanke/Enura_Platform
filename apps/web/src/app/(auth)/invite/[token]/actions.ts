'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AcceptInvitationInput = {
  token: string
  firstName: string
  lastName: string
  password: string
}

type AcceptInvitationResult = {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// acceptInvitation — validates token, creates auth user + profile + role
// ---------------------------------------------------------------------------

export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  const supabase = createSupabaseServerClient()
  const serviceClient = createSupabaseServiceClient()

  // Validate input
  if (!input.token) {
    return { success: false, error: 'Kein Einladungstoken vorhanden.' }
  }
  if (!input.firstName.trim()) {
    return { success: false, error: 'Vorname ist erforderlich.' }
  }
  if (!input.lastName.trim()) {
    return { success: false, error: 'Nachname ist erforderlich.' }
  }
  if (input.password.length < 8) {
    return { success: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }
  }

  // Fetch invitation
  const { data: invitation, error: invError } = await supabase
    .from('user_invitations')
    .select('*')
    .eq('token', input.token)
    .maybeSingle()

  if (invError || !invitation) {
    return { success: false, error: 'Ungueltige Einladung.' }
  }

  // Check status
  if (invitation.status !== 'pending') {
    return {
      success: false,
      error:
        invitation.status === 'accepted'
          ? 'Diese Einladung wurde bereits angenommen.'
          : 'Diese Einladung ist nicht mehr gueltig.',
    }
  }

  // Check expiry
  const expiresAt = new Date(invitation.expires_at as string)
  if (expiresAt < new Date()) {
    return { success: false, error: 'Diese Einladung ist abgelaufen.' }
  }

  const email = invitation.email as string
  const companyId = invitation.company_id as string
  const holdingId = (invitation.holding_id as string) ?? null
  const roleKey = invitation.role_key as string

  // Create Supabase Auth user via service client (admin.createUser bypasses email confirmation)
  const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      company_id: companyId,
    },
  })

  if (authError || !authUser.user) {
    // User might already exist
    if (authError?.message?.includes('already registered')) {
      return {
        success: false,
        error: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits. Bitte melden Sie sich unter /login an.',
      }
    }
    return {
      success: false,
      error: `Benutzerkonto konnte nicht erstellt werden: ${authError?.message ?? 'Unbekannter Fehler'}`,
    }
  }

  const userId = authUser.user.id

  // Create profile
  const { error: profileError } = await serviceClient.from('profiles').insert({
    id: userId,
    company_id: companyId,
    holding_id: holdingId,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    display_name: `${input.firstName.trim()} ${input.lastName.trim()}`,
    must_reset_password: false,
    totp_enabled: false,
    is_active: true,
  })

  if (profileError) {
    // Rollback: delete auth user
    await serviceClient.auth.admin.deleteUser(userId)
    return {
      success: false,
      error: `Profil konnte nicht erstellt werden: ${profileError.message}`,
    }
  }

  // Assign role based on role_key
  if (roleKey === 'holding_admin') {
    // Holding admin gets an entry in holding_admins_v2
    await serviceClient.from('holding_admins_v2').insert({
      profile_id: userId,
      holding_id: holdingId,
    })
  } else {
    // Company role — find the role and assign via profile_roles
    const { data: roleRow } = await serviceClient
      .from('roles')
      .select('id')
      .eq('key', roleKey)
      .eq('company_id', companyId)
      .maybeSingle()

    // Fallback: try system role without company_id
    let roleId = roleRow?.id as string | undefined
    if (!roleId) {
      const { data: systemRole } = await serviceClient
        .from('roles')
        .select('id')
        .eq('key', roleKey)
        .eq('is_system', true)
        .maybeSingle()

      roleId = systemRole?.id as string | undefined
    }

    if (roleId) {
      await serviceClient.from('profile_roles').insert({
        profile_id: userId,
        role_id: roleId,
      })
    }
  }

  // Mark invitation as accepted
  await serviceClient
    .from('user_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      profile_id: userId,
    })
    .eq('id', invitation.id)

  // Redirect to login
  redirect('/login')
}
