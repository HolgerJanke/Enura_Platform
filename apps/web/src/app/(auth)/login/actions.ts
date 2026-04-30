'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginSchema } from '@enura/types'
import type { MockSession } from '@/lib/auth'

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

export async function loginAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Ungültige Eingabe. Bitte ueberprüfen Sie Ihre Angaben.' }
  }

  // ── Mock auth: accept any credentials, set mock-session cookie ──
  if (MOCK_AUTH) {
    const email = parsed.data.email
    const namePart = email.split('@')[0] ?? 'user'

    const mockSession: MockSession = {
      userId: '00000000-0000-0000-0000-000000000099',
      companyId: '00000000-0000-0000-0000-000000000001', // alpen-energie
      email,
      firstName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      lastName: 'Demo',
      displayName: `${namePart.charAt(0).toUpperCase() + namePart.slice(1)} Demo`,
      roles: ['super_user'],
      permissions: [
        'module:dashboard:read',
        'module:setter:read',
        'module:berater:read',
        'module:leads:read',
        'module:innendienst:read',
        'module:bau:read',
        'module:finance:read',
        'module:admin:read',
        'module:admin:write',
        'module:reports:read',
        'connector:manage',
      ],
      isHoldingAdmin: false,
      mustResetPassword: false,
      totpEnabled: true,
    }

    cookies().set('mock-session', JSON.stringify(mockSession), {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return { success: true }
  }

  // ── Real Supabase auth ──
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'E-Mail-Adresse oder Passwort ist falsch.' }
  }

  return { success: true }
}
