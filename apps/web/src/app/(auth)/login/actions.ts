'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginSchema } from '@enura/types'

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

/** Company ID for the default "Alpen Energie GmbH" tenant */
const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

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

  // ── Mock Auth ─────────────────────────────────────────────────────────
  if (MOCK_AUTH) {
    const cookieStore = cookies()
    const mockSession = {
      userId: 'mock-user-001',
      companyId: DEFAULT_COMPANY_ID,
      holdingId: null,
      email: parsed.data.email,
      firstName: parsed.data.email.split('@')[0],
      lastName: 'User',
      displayName: parsed.data.email.split('@')[0],
      roles: ['super_user'],
      permissions: [
        'module:setter:read', 'module:setter:write',
        'module:berater:read', 'module:berater:write',
        'module:leads:read', 'module:leads:write',
        'module:innendienst:read', 'module:innendienst:write',
        'module:bau:read', 'module:bau:write',
        'module:finance:read', 'module:finance:write',
        'module:admin:read', 'module:admin:write',
      ],
      isHoldingAdmin: true,
      isEnuraAdmin: true,
      mustResetPassword: false,
      totpEnabled: true,
    }

    cookieStore.set('mock-session', JSON.stringify(mockSession), {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return { success: true }
  }

  // ── Real Supabase Auth ────────────────────────────────────────────────
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
