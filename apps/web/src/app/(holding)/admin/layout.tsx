export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { homeFor } from '@/lib/authz/policy'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HoldingShell } from '@/components/holding-shell'
import { AdminBar } from '@/components/AdminBar'

const HOLDING_NAV_ITEMS = [
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

  // Backstop to the edge tier-gate in middleware.ts. OD-2: entry is isHoldingAdmin
  // ONLY (a pure Enura admin is NOT admitted here and is sent to /platform). The
  // denied user is routed to their own home surface, not unconditionally to
  // /dashboard (which was wrong for an Enura admin — finding C4/C6).
  if (!session.isHoldingAdmin) {
    const target = homeFor(session)
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: `window.location.href="${target}"` }} />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Kein Zugriff. Weiterleitung...</p>
            <a href={target} className="text-blue-600 underline text-sm">Fortfahren</a>
          </div>
        </div>
      </>
    )
  }

  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(' ') || session.profile.display_name

  // The "← Dashboard" back-link is only meaningful as a step UP to a higher
  // tier. An Enura (group) admin belongs at the platform overview, which lists
  // every holding, so we send them there. A holding admin is already at the top
  // of their world: the holding console itself is their overview (reached via
  // "Unternehmen"), and there is no higher dashboard to return to — so we omit
  // the link rather than drop them into an unrelated company Prozesshaus.
  const navItems = session.isEnuraAdmin
    ? [{ label: '← Dashboard', href: '/platform', icon: 'arrow-left' }, ...HOLDING_NAV_ITEMS]
    : HOLDING_NAV_ITEMS

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

  return (
    <HoldingShell navItems={navItems} userName={displayName} holdingName={holdingName}>
      {children}
    </HoldingShell>
  )
}
