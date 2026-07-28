'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { writeAuditLog } from '@/lib/audit'

export type EnrolmentResult =
  | {
      qrCode: string
      secret: string
      factorId: string
      error?: undefined
    }
  | {
      error: string
      qrCode?: undefined
      secret?: undefined
      factorId?: undefined
    }

export async function initiateEnrolmentAction(): Promise<EnrolmentResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // A user only reaches this action when profiles.totp_enabled = false (the auth
  // gate in middleware.ts / session.ts). That means the app does NOT treat them
  // as 2FA-protected, so ANY TOTP factor still attached to their Supabase Auth
  // account is stale: either an interrupted enrolment (unverified) or an orphan
  // left behind by an admin 2FA reset (verified). Because the friendlyName below
  // is fixed, any such leftover makes enroll() fail with a name conflict, which
  // permanently traps the user at the mandatory 2FA gate.
  //
  // Clear every leftover TOTP factor before enrolling. This uses the service-role
  // admin API, scoped strictly to the verified current user's own id, because the
  // user-scoped mfa.unenroll() cannot remove a VERIFIED factor from an AAL1
  // session — exactly the state a freshly-signed-in, just-reset user is in.
  const serviceClient = createSupabaseServiceClient()
  const { data: adminFactors } = await serviceClient.auth.admin.mfa.listFactors({
    userId: user.id,
  })
  for (const factor of adminFactors?.factors ?? []) {
    if (factor.factor_type === 'totp') {
      await serviceClient.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id })
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator App',
  })

  if (error || !data) {
    // Never surface the raw Supabase error to the client (CLAUDE.md §13), but log
    // it server-side so a genuine misconfiguration is diagnosable.
    console.error('[enrol-2fa] mfa.enroll failed:', error?.message ?? 'no data returned')
    return { error: 'Fehler beim Einrichten der 2-Faktor-Authentifizierung.' }
  }

  return {
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    factorId: data.id,
  }
}

export async function verifyEnrolmentAction(
  factorId: string,
  code: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Create challenge
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })

  if (challengeError || !challengeData) {
    return { error: 'Challenge konnte nicht erstellt werden.' }
  }

  // Verify code
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  })

  if (verifyError) {
    return { error: 'Ungültiger Code. Bitte versuchen Sie es erneut.' }
  }

  // Update profile
  const serviceClient = createSupabaseServiceClient()
  await serviceClient
    .from('profiles')
    .update({
      totp_enabled: true,
      totp_enrolled_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  // Audit log
  await writeAuditLog({
    companyId: (user.user_metadata?.['company_id'] as string | null) ?? null,
    actorId: user.id,
    action: 'auth.2fa_enrolled',
    tableName: 'profiles',
    recordId: user.id,
  })

  // Re-issue the token so the access-token hook (migration 047, once registered)
  // rebuilds the totp_enabled claim; harmless no-op until the hook exists.
  try {
    await supabase.auth.refreshSession()
  } catch {
    /* non-fatal — the middleware gate also reads the DB */
  }

  redirect('/')
}
