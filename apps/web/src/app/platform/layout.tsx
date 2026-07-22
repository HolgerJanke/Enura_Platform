export const dynamic = 'force-dynamic'

import { getSession, authGateRedirect } from '@/lib/session'
import { PlatformShell } from '@/components/platform-shell'

const PLATFORM_NAV_ITEMS = [
  { label: '← Dashboard', href: '/dashboard', icon: 'arrow-left' },
  { label: 'Übersicht', href: '/platform', icon: 'overview' },
  { label: 'Neue Holding', href: '/platform/holdings/new', icon: 'building' },
  { label: 'Add-ons', href: '/admin/settings/addons', icon: 'puzzle' },
  { label: 'Gesundheit', href: '/platform/health', icon: 'health' },
  { label: 'Audit', href: '/platform/audit', icon: 'audit' },
]

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !session.isEnuraAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Zugriff verweigert</p>
          <a href="/login" className="text-blue-600 underline text-sm">Zur Anmeldung</a>
        </div>
      </div>
    )
  }

  // Auth gates (CLAUDE.md §4.2): force temp-password reset, then 2FA
  // enrolment, before any console content renders. Script-based redirect —
  // redirect() in Server Component layouts causes 404 on Vercel.
  const gate = authGateRedirect(session)
  if (gate) {
    const message =
      gate === '/reset-password'
        ? 'Bitte legen Sie zuerst ein neues Passwort fest...'
        : 'Bitte richten Sie zuerst die Zwei-Faktor-Authentifizierung ein...'
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: `window.location.href=${JSON.stringify(gate)}` }} />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{message}</p>
            <a href={gate} className="text-blue-600 underline text-sm">Weiter</a>
          </div>
        </div>
      </>
    )
  }

  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(' ') || session.profile.display_name

  // "← Dashboard" leads to the company dashboard — only meaningful for
  // admins who also belong to a company.
  const navItems = session.companyId
    ? PLATFORM_NAV_ITEMS
    : PLATFORM_NAV_ITEMS.filter((item) => item.href !== '/dashboard')

  return (
    <PlatformShell navItems={navItems} userName={displayName}>
      {children}
    </PlatformShell>
  )
}
