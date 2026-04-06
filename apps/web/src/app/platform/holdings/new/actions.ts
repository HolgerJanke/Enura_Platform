'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

async function requireEnuraSession() {
  const session = await getSession()
  if (!session?.isEnuraAdmin) {
    throw new Error('Nicht autorisiert')
  }
  return session
}

export async function checkSlugAvailability(
  slug: string,
): Promise<{ available: boolean }> {
  if (!slug || slug.length < 3) return { available: false }

  const supabase = createSupabaseServerClient()

  const { data } = await supabase
    .from('holdings')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  return { available: data === null }
}

export async function saveWizardStep(
  step: number,
  stepData: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  // Validate step data
  switch (step) {
    case 1:
      if (!stepData.holdingName || stepData.holdingName.length < 2) {
        return { success: false, error: 'Holding-Name muss mindestens 2 Zeichen lang sein' }
      }
      if (!stepData.holdingSlug || stepData.holdingSlug.length < 3) {
        return { success: false, error: 'Slug muss mindestens 3 Zeichen lang sein' }
      }
      break
    case 4:
      if (!stepData.companyName || stepData.companyName.length < 2) {
        return { success: false, error: 'Unternehmensname muss mindestens 2 Zeichen lang sein' }
      }
      if (!stepData.companySlug || stepData.companySlug.length < 3) {
        return { success: false, error: 'Unternehmens-Slug muss mindestens 3 Zeichen lang sein' }
      }
      break
    case 5:
      if (!stepData.adminEmail || !stepData.adminEmail.includes('@')) {
        return { success: false, error: 'Gueltige E-Mail-Adresse erforderlich' }
      }
      if (!stepData.adminFirstName || !stepData.adminLastName) {
        return { success: false, error: 'Vor- und Nachname sind erforderlich' }
      }
      break
  }

  return { success: true }
}

type CompleteWizardInput = {
  holdingName: string
  holdingSlug: string
  branding: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    textPrimary: string
    textSecondary: string
    font: string
    fontUrl: string
    radius: string
  }
  language: string
  locale: string
  currency: string
  dateFormat: string
  companyName: string
  companySlug: string
  adminEmail: string
  adminFirstName: string
  adminLastName: string
}

export async function completeWizard(
  input: CompleteWizardInput,
): Promise<{ success: boolean; holdingId?: string; error?: string }> {
  let session
  try {
    session = await requireEnuraSession()
  } catch (err) {
    return { success: false, error: `Autorisierungsfehler: ${err instanceof Error ? err.message : String(err)}` }
  }

  let serviceClient
  try {
    serviceClient = createSupabaseServiceClient()
  } catch (err) {
    return { success: false, error: `Service-Client-Fehler: ${err instanceof Error ? err.message : String(err)}` }
  }

  // 1. Create the holding
  const { data: holding, error: holdingError } = await serviceClient
    .from('holdings')
    .insert({
      name: input.holdingName,
      slug: input.holdingSlug,
      status: 'active',
      branding: input.branding,
      created_by: session.profile.id,
    })
    .select('id')
    .single()

  if (holdingError || !holding) {
    return { success: false, error: holdingError?.message ?? 'Holding konnte nicht erstellt werden' }
  }

  const holdingId = (holding as { id: string }).id

  // 2. Create the first company
  const { error: companyError } = await serviceClient
    .from('companies')
    .insert({
      holding_id: holdingId,
      name: input.companyName,
      slug: input.companySlug,
      status: 'active',
      created_by: session.profile.id,
    })

  if (companyError) {
    return { success: false, error: companyError.message }
  }

  // 3. Update subscription (auto-created by trigger, but update with language/region metadata)
  // The holding_subscriptions row is created by the trg_auto_create_holding_subscription trigger
  // We just need to ensure it exists; no additional update needed for now.

  // 4. Create onboarding record
  const { error: onboardingError } = await serviceClient
    .from('holding_onboarding')
    .insert({
      holding_id: holdingId,
      current_step: 6,
      completed_steps: [1, 2, 3, 4, 5, 6],
      wizard_data: {
        language: input.language,
        locale: input.locale,
        currency: input.currency,
        dateFormat: input.dateFormat,
        branding: input.branding,
      },
      is_complete: true,
      completed_at: new Date().toISOString(),
    })

  if (onboardingError) {
    // Non-fatal: onboarding record is for tracking only
    console.error('Onboarding-Datensatz konnte nicht erstellt werden:', onboardingError.message)
  }

  // 5. Get the first company ID (just created above)
  const { data: firstCompany } = await serviceClient
    .from('companies')
    .select('id')
    .eq('holding_id', holdingId)
    .limit(1)
    .single()

  const companyId = firstCompany ? (firstCompany as { id: string }).id : null

  // 6. Create the admin user account
  const tempPassword = `Enura-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}!`

  const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
    email: input.adminEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      first_name: input.adminFirstName,
      last_name: input.adminLastName,
    },
  })

  if (authError || !authUser?.user) {
    // User might already exist — try to find them
    const { data: existingUsers } = await serviceClient.auth.admin.listUsers()
    const existing = existingUsers?.users?.find((u) => u.email === input.adminEmail)

    if (existing) {
      // User exists — update their profile to link to this holding + company
      await serviceClient
        .from('profiles')
        .update({
          holding_id: holdingId,
          company_id: companyId,
          first_name: input.adminFirstName,
          last_name: input.adminLastName,
        })
        .eq('id', existing.id)

      // Make them holding admin
      await serviceClient
        .from('holding_admins')
        .upsert({ profile_id: existing.id }, { onConflict: 'profile_id' })

      await serviceClient
        .from('holding_admins_v2')
        .upsert(
          { holding_id: holdingId, profile_id: existing.id, is_owner: true },
          { onConflict: 'holding_id,profile_id' },
        )

      // Assign super_user role for the first company
      if (companyId) {
        const { data: superRole } = await serviceClient
          .from('roles')
          .select('id')
          .eq('company_id', companyId)
          .eq('key', 'super_user')
          .single()

        if (superRole) {
          await serviceClient
            .from('profile_roles')
            .upsert(
              { profile_id: existing.id, role_id: (superRole as { id: string }).id },
              { onConflict: 'profile_id,role_id' },
            )
        }
      }

      return { success: true, holdingId }
    }

    return { success: false, error: `Benutzer konnte nicht erstellt werden: ${authError?.message ?? 'Unbekannter Fehler'}` }
  }

  const userId = authUser.user.id

  // 7. Create profile record
  await serviceClient
    .from('profiles')
    .upsert({
      id: userId,
      holding_id: holdingId,
      company_id: companyId,
      first_name: input.adminFirstName,
      last_name: input.adminLastName,
      must_reset_password: true,
      totp_enabled: false,
      is_active: true,
    }, { onConflict: 'id' })

  // 8. Make them holding admin
  await serviceClient
    .from('holding_admins')
    .upsert({ profile_id: userId }, { onConflict: 'profile_id' })

  await serviceClient
    .from('holding_admins_v2')
    .upsert(
      { holding_id: holdingId, profile_id: userId, is_owner: true },
      { onConflict: 'holding_id,profile_id' },
    )

  // 9. Assign super_user role for the first company
  if (companyId) {
    const { data: superRole } = await serviceClient
      .from('roles')
      .select('id')
      .eq('company_id', companyId)
      .eq('key', 'super_user')
      .single()

    if (superRole) {
      await serviceClient
        .from('profile_roles')
        .upsert(
          { profile_id: userId, role_id: (superRole as { id: string }).id },
          { onConflict: 'profile_id,role_id' },
        )
    }
  }

  // 10. Create invitation record (for tracking)
  await serviceClient
    .from('user_invitations')
    .insert({
      holding_id: holdingId,
      company_id: companyId,
      email: input.adminEmail,
      role_name: 'holding_admin',
      invited_by: session.profile.id,
    })

  // TODO: Send invitation email with temp password via Resend

  return { success: true, holdingId }
}
