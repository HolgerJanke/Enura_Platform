'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginSchema } from '@enura/types'
import { redirect } from 'next/navigation'

export async function loginAction(
  formData: FormData
): Promise<{ error: string }> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Ungueltige Eingabe. Bitte ueberpruefen Sie Ihre Angaben.' }
  }

  try {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      return { error: 'E-Mail-Adresse oder Passwort ist falsch.' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Anmeldefehler: ${msg}` }
  }

  // redirect() throws NEXT_REDIRECT — caught by Next.js, not by our catch
  redirect('/dashboard')
}
