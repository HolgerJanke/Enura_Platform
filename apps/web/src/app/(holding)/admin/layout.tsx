export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { homeFor } from '@/lib/authz/policy'
import { NAV_CONFIG, filterNav } from '@/lib/nav/nav-config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HoldingShell } from '@/components/holding-shell'

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

  // Policy-filtered: "visible ⇔ accessible" (see lib/nav/nav-config.ts). The
  // "← Dashboard" back-link is only meaningful as a step UP to a higher tier:
  // it's encoded with `tier: 'enura'`, so it shows iff the session is ALSO an
  // Enura (group) admin — reproducing the original `session.isEnuraAdmin`
  // check exactly. A holding admin is already at the top of their world: the
  // holding console itself is their overview (reached via "Unternehmen"), and
  // there is no higher dashboard to return to — so the link is absent for them.
  const navItems = filterNav(NAV_CONFIG.holding, session).map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon ?? 'default',
  }))

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
