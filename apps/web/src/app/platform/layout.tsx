export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { homeFor } from '@/lib/authz/policy'
import { NAV_CONFIG, filterNav } from '@/lib/nav/nav-config'
import { PlatformShell } from '@/components/platform-shell'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  // Backstop to the authoritative edge tier-gate in middleware.ts (finding C4:
  // this branch used to render an inert 200 "Zugriff verweigert" dead-end that
  // never actually redirected). Now it redirects the wrong-tier user to their own
  // home surface. Uses the codebase's client-script redirect pattern (the tier
  // layouts avoid next/navigation redirect() due to a documented Vercel layout
  // 404); the real 307 has already happened at the edge before this renders.
  if (!session || !session.isEnuraAdmin) {
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
  // "← Dashboard" item is included in NAV_CONFIG.platform but, per OD-1, no
  // session reaching this shell can ever hold Company tier — so it never
  // shows here now, which is a deliberate correction (see nav-config.ts note).
  const navItems = filterNav(NAV_CONFIG.platform, session).map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon ?? 'default',
  }))

  return (
    <PlatformShell navItems={navItems} userName={displayName}>
      {children}
    </PlatformShell>
  )
}
