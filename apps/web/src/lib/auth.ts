import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type MockSession = {
  userId: string
  companyId: string | null
  email: string
  firstName: string
  lastName: string
  displayName: string
  roles: string[]
  permissions: string[]
  isHoldingAdmin: boolean
  mustResetPassword: boolean
  totpEnabled: boolean
}

export function getSession(): MockSession | null {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('mock-session')
  if (!sessionCookie?.value) return null

  try {
    return JSON.parse(sessionCookie.value) as MockSession
  } catch {
    return null
  }
}

export function requireSession(): MockSession {
  const session = getSession()
  if (!session) {
    redirect('/login')
  }
  return session
}

export function requireFullAuth(): MockSession {
  const session = requireSession()

  if (session.mustResetPassword) {
    redirect('/reset-password')
  }

  if (!session.totpEnabled) {
    redirect('/enrol-2fa')
  }

  return session
}

export function hasPermission(session: MockSession, permission: string): boolean {
  if (session.isHoldingAdmin) return true
  return session.permissions.includes(permission)
}
