'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { ResetPasswordSchema } from '@enura/types'
import { redirect } from 'next/navigation'
import { writeAuditLog } from '@/lib/audit'

export async function resetPasswordAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify user is authenticated
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/login')
  }

  // Update password via Supabase Auth
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (updateError) {
    return {
      error: 'Passwort konnte nicht geändert werden. Bitte versuchen Sie es erneut.',
    }
  }

  // Update profile: must_reset_password = false
  const serviceClient = createSupabaseServiceClient()
  await serviceClient
    .from('profiles')
    .update({
      must_reset_password: false,
      password_reset_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  // Audit log
  await writeAuditLog({
    companyId: (user.user_metadata?.['company_id'] as string | null) ?? null,
    actorId: user.id,
    action: 'auth.password_reset',
    tableName: 'profiles',
    recordId: user.id,
  })

  // Middleware will redirect to /enrol-2fa if totp_enabled is false
  redirect('/')
}
