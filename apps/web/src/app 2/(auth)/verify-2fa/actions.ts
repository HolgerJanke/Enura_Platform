'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export async function verify2faAction(code: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Rate limit by user ID
  const headerStore = await headers()
  void headerStore // ensure headers are read for server action context
  const rateLimitKey = `totp:${user.id}`
  const { limited, retryAfterMs } = checkRateLimit(rateLimitKey)
  if (limited) {
    const minutes = Math.ceil(retryAfterMs / 60000)
    return {
      error: `Zu viele Versuche. Bitte warten Sie ${minutes} Minuten.`,
    }
  }

  // Find the verified TOTP factor
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const totpFactor = factors?.totp?.find((f) => f.status === 'verified')
  if (!totpFactor) {
    return { error: 'Kein TOTP-Faktor gefunden.' }
  }

  // Challenge + verify
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
  if (challengeError || !challengeData) {
    return { error: 'Verifizierung fehlgeschlagen.' }
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challengeData.id,
    code,
  })

  if (verifyError) {
    return { error: 'Ungueltiger Code. Bitte versuchen Sie es erneut.' }
  }

  // Audit
  await writeAuditLog({
    tenantId: (user.user_metadata?.['tenant_id'] as string | null) ?? null,
    actorId: user.id,
    action: 'auth.2fa_verified',
  })

  redirect('/')
}
