'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginSchema } from '@enura/types'
import { redirect } from 'next/navigation'

export async function loginAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Ungueltige Eingabe. Bitte ueberpruefen Sie Ihre Angaben.' }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'E-Mail-Adresse oder Passwort ist falsch.' }
  }

  // redirect() throws internally — must NOT be inside try/catch
  redirect('/dashboard')
}
