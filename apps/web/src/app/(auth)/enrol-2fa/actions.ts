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

  // An interrupted enrolment leaves an unverified factor behind. Supabase
  // rejects a new factor whose friendly name duplicates an existing one, which
  // would permanently block re-enrolment — so clear any stale (unverified)
  // factors before creating a fresh one.
  const { data: existing } = await supabase.auth.mfa.listFactors()
  const stale = (existing?.all ?? []).filter((f) => f.status !== 'verified')
  for (const f of stale) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator App',
  })

  if (error || !data) {
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

  redirect('/')
}
