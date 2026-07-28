export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { homeFor } from '@/lib/authz/policy'
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

  // Hide the "← Dashboard" link for admins with no company — it would only
  // bounce them straight back to a console.
  const navItems = session.companyId
    ? PLATFORM_NAV_ITEMS
    : PLATFORM_NAV_ITEMS.filter((item) => item.href !== '/dashboard')

  return (
    <PlatformShell navItems={navItems} userName={displayName}>
      {children}
    </PlatformShell>
  )
}
