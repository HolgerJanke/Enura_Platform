'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginSchema } from '@enura/types'

const MOCK_AUTH = process.env.MOCK_AUTH !== 'false'

/** Company ID for the default tenant (env-driven, no hardcoded tenant name) */
const DEFAULT_COMPANY_ID =
  process.env.DEV_DEFAULT_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001'

/** Known users — resolved to proper names and roles in mock auth */
const KNOWN_USERS: Record<string, { firstName: string; lastName: string; roles: string[]; isEnuraAdmin: boolean }> = {
  's.vogel@alpen-energie.ch':   { firstName: 'Sarah',   lastName: 'Vogel',   roles: ['super_user'],  isEnuraAdmin: true },
  'm.krings@alpen-energie.ch':  { firstName: 'Michael', lastName: 'Krings',  roles: ['super_user'],  isEnuraAdmin: true },
  'h.janke@alpen-energie.ch':   { firstName: 'Holger',  lastName: 'Janke',   roles: ['super_user'],  isEnuraAdmin: true },
  'n.janke@alpen-energie.ch':   { firstName: 'Nicos',   lastName: 'Janke',   roles: ['super_user'],  isEnuraAdmin: true },
}

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
    const email = parsed.data.email.toLowerCase()
    const known = KNOWN_USERS[email]
    const prefix = email.split('@')[0] ?? 'user'

    const mockSession = {
      userId: `mock-${prefix.replace(/\./g, '-')}`,
      companyId: DEFAULT_COMPANY_ID,
      holdingId: null,
      email,
      firstName: known?.firstName ?? prefix.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      lastName: known?.lastName ?? '',
      displayName: known ? `${known.firstName} ${known.lastName}` : prefix,
      roles: known?.roles ?? ['super_user'],
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
      isEnuraAdmin: known?.isEnuraAdmin ?? true,
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
