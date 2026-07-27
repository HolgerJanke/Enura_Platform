'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginSchema } from '@enura/types'
import { getSession, authGateRedirect } from '@/lib/session'
import { resolveLandingPath } from '@/lib/landing'

export async function loginAction(
  formData: FormData
): Promise<{ error: string } | { success: true; redirectTo: string }> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Ungültige Eingabe. Bitte ueberprüfen Sie Ihre Angaben.' }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'E-Mail-Adresse oder Passwort ist falsch.' }
  }

  // Decide the landing target here rather than hardcoding /dashboard: an admin
  // who also belongs to a company would otherwise be bounced off the company
  // dashboard back to their console. The auth gates (temp password / 2FA) take
  // precedence over the destination.
  const session = await getSession()
  const redirectTo = session
    ? (authGateRedirect(session) ?? resolveLandingPath(session))
    : '/dashboard'

  return { success: true, redirectTo }
}
