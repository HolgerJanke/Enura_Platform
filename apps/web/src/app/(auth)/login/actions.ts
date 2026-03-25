'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginSchema } from '@enura/types'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Ungueltige Eingabe. Bitte ueberpruefen Sie Ihre Angaben.' }
  }

  // Rate limiting by IP
  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rateLimitKey = `login:${ip}`
  const { limited, retryAfterMs } = checkRateLimit(rateLimitKey)
  if (limited) {
    const minutes = Math.ceil(retryAfterMs / 60000)
    return {
      error: `Zu viele Anmeldeversuche. Bitte versuchen Sie es in ${minutes} Minuten erneut.`,
    }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'E-Mail-Adresse oder Passwort ist falsch.' }
  }

  // Success — reset rate limit and redirect
  resetRateLimit(rateLimitKey)
  redirect('/')
}
