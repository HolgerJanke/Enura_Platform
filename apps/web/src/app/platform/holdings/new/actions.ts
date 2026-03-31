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
  const session = await requireEnuraSession()

  // Use service client for cross-table operations
  const serviceClient = createSupabaseServiceClient()

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

  // 5. Create user invitation for the holding admin
  const { error: invitationError } = await serviceClient
    .from('user_invitations')
    .insert({
      holding_id: holdingId,
      email: input.adminEmail,
      role_name: 'holding_admin',
      invited_by: session.profile.id,
    })

  if (invitationError) {
    return { success: false, error: `Einladung konnte nicht erstellt werden: ${invitationError.message}` }
  }

  // TODO: Send invitation email via Resend when configured

  return { success: true, holdingId }
}
