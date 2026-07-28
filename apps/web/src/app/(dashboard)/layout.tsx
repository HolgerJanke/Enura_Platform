export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession, authGateRedirect } from '@/lib/session'
import { canEnterTier, homeFor } from '@/lib/authz/policy'
import { NAV_CONFIG, filterNav } from '@/lib/nav/nav-config'
import { getCompanyContext } from '@/lib/tenant'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // If no session, show a loading/redirect state instead of calling redirect()
  // redirect() in Server Component layouts causes 404 on Vercel
  // The middleware handles the actual auth redirect
  if (!session) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: 'window.location.href="/login"' }} />
        <div className="min-h-screen flex items-center justify-center bg-brand-background">
          <div className="text-center">
            <p className="text-brand-text-secondary mb-4">Weiterleitung zur Anmeldung...</p>
            <a href="/login" className="text-brand-primary underline text-sm">
              Zur Anmeldung
            </a>
          </div>
        </div>
      </>
    )
  }

  // CLAUDE.md §4.2 gates (b)/(c): temp password reset + 2FA enrolment must be
  // complete before any dashboard content renders. Return the redirect ONLY —
  // rendering children alongside it would still ship gated content to the client.
  const gateRedirect = authGateRedirect(session)
  if (gateRedirect) {
    return (
      <>
        <script
          dangerouslySetInnerHTML={{ __html: `window.location.href="${gateRedirect}"` }}
        />
        <div className="min-h-screen flex items-center justify-center bg-brand-background">
          <div className="text-center">
            <p className="text-brand-text-secondary mb-4">Weiterleitung...</p>
            <a href={gateRedirect} className="text-brand-primary underline text-sm">
              Fortfahren
            </a>
          </div>
        </div>
      </>
    )
  }

  // Company-tier gate (OD-1 / finding C1). Only Company users belong in the
  // (dashboard) shell. A holding/enura admin is NOT a Company user (sessionTiers
  // excludes them even with a stray company_id) and is routed to their own
  // console. Middleware gates /admin and /platform; this gates the company section
  // on entry (tier cannot change on soft-nav within the (dashboard) group, so an
  // entry-time check is sufficient for the tier boundary — per-module RBAC is
  // enforced per page).
  if (!canEnterTier(session, 'company')) {
    const target = homeFor(session)
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: `window.location.href="${target}"` }} />
        <div className="min-h-screen flex items-center justify-center bg-brand-background">
          <div className="text-center">
            <p className="text-brand-text-secondary mb-4">Weiterleitung...</p>
            <a href={target} className="text-brand-primary underline text-sm">Fortfahren</a>
          </div>
        </div>
      </>
    )
  }

  const { companyName: rawCompanyName } = getCompanyContext()
  // Enura admins with no company see neutral branding
  const companyName = session.isEnuraAdmin && !session.companyId
    ? 'Enura Group'
    : rawCompanyName

  const displayName = session.profile.display_name ?? session.profile.first_name ?? 'Benutzer'
  const roleLabel = session.roles[0]?.label ?? ''

  // Fetch active critical anomaly count for banner
  let criticalAnomalyCount = 0
  if (session.companyId) {
    const supabase = createSupabaseServerClient()
    const { count } = await supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', session.companyId)
      .eq('is_active', true)
      .eq('severity', 'critical')

    criticalAnomalyCount = count ?? 0
  }

  // Finanzplanung is now accessed via Process House (M2), not sidebar

  const isSuperUser = session.roles.some(r => r.key === 'super_user')

  // Policy-filtered: "visible ⇔ accessible" (see lib/nav/nav-config.ts). Each
  // Company-Admin link in the dashboard-shell modal is shown iff the session
  // actually holds the module permission its route requires — replacing the
  // bare `isSuperUser` gate on the section (kept above the modal itself,
  // since a super_user without every module:admin:* grant can still see a
  // (possibly shorter) list; an empty list simply hides the section).
  const companyAdminNavItems = filterNav(NAV_CONFIG.companyAdmin, session).map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon ?? 'default',
  }))

  return (
    <>
      <DashboardShell
        companyName={companyName}
        userName={displayName}
        userRole={roleLabel}
        isHoldingAdmin={session.isHoldingAdmin}
        isSuperUser={isSuperUser}
        companyAdminNavItems={companyAdminNavItems}
      >
        {criticalAnomalyCount > 0 && (
        <div className="border-b border-red-300 bg-red-600 px-4 py-2.5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" aria-hidden="true">&#9888;&#65039;</span>
              <span className="text-sm font-medium">
                {criticalAnomalyCount === 1
                  ? '1 kritische Anomalie erkannt'
                  : `${criticalAnomalyCount} kritische Anomalien erkannt`}
              </span>
            </div>
            <Link
              href="/anomalies"
              className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/30"
            >
              Alle anzeigen
            </Link>
          </div>
        </div>
      )}
      {children}
    </DashboardShell>
    </>
  )
}
