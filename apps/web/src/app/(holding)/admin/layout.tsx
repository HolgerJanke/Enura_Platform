export const dynamic = 'force-dynamic'

import { getSession, authGateRedirect } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HoldingShell } from '@/components/holding-shell'
import { AdminBar } from '@/components/AdminBar'

const HOLDING_NAV_ITEMS = [
  { label: '← Dashboard', href: '/dashboard', icon: 'arrow-left' },
  { label: 'Unternehmen', href: '/admin', icon: 'building' },
  { label: 'Hilfe', href: '/help', icon: 'help-circle' },
]

const HOLDING_ADMIN_BAR_NAV = [
  { label: 'Prozesse', href: '/admin/processes' },
  { label: 'Integrationen', href: '/admin/tools' },
  { label: 'Benutzer', href: '/admin/users' },
  { label: 'Branding', href: '/admin/settings/branding' },
  { label: 'Berichte', href: '/admin/analytics' },
  { label: 'Abrechnung', href: '/admin/billing' },
  { label: '+ Unternehmen', href: '/admin/companies/new' },
]

export default async function HoldingAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: 'window.location.href="/login"' }} />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Weiterleitung zur Anmeldung...</p>
            <a href="/login" className="text-blue-600 underline text-sm">Zur Anmeldung</a>
          </div>
        </div>
      </>
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

  if (!session.isHoldingAdmin) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: 'window.location.href="/dashboard"' }} />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Kein Zugriff. Weiterleitung...</p>
            <a href="/dashboard" className="text-blue-600 underline text-sm">Zum Dashboard</a>
          </div>
        </div>
      </>
    )
  }

  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(' ') || session.profile.display_name

  // Fetch actual holding name
  let holdingName = 'Holding'
  if (session.holdingId) {
    const supabase = createSupabaseServerClient()
    const { data: holding } = await supabase
      .from('holdings')
      .select('name')
      .eq('id', session.holdingId)
      .single()
    if (holding) holdingName = (holding as { name: string }).name
  }

  // "← Dashboard" leads to the company dashboard — only meaningful for
  // admins who also belong to a company.
  const navItems = session.companyId
    ? HOLDING_NAV_ITEMS
    : HOLDING_NAV_ITEMS.filter((item) => item.href !== '/dashboard')

  return (
    <HoldingShell navItems={navItems} userName={displayName} holdingName={holdingName}>
      {children}
    </HoldingShell>
  )
}
