import { getSession } from '@/lib/session'
import { HoldingShell } from '@/components/holding-shell'
import { AdminBar } from '@/components/AdminBar'

const HOLDING_NAV_ITEMS = [
  { label: '← Dashboard', href: '/dashboard', icon: 'arrow-left' },
  { label: 'Unternehmen', href: '/admin', icon: 'building' },
  { label: 'Benutzer', href: '/admin/users', icon: 'users' },
  { label: 'Finanzen', href: '/admin/finance', icon: 'banknote' },
  { label: 'Secrets', href: '/admin/secrets', icon: 'key' },
  { label: 'Tools', href: '/admin/tools', icon: 'wrench' },
  { label: 'Prozesse', href: '/admin/processes', icon: 'workflow' },
  { label: 'Analytics', href: '/admin/analytics', icon: 'bar-chart' },
  { label: 'Compliance', href: '/admin/compliance', icon: 'shield-check' },
  { label: 'Zertifizierungen', href: '/admin/compliance/certifications', icon: 'award' },
  { label: 'Branding', href: '/admin/settings/branding', icon: 'palette' },
  { label: 'Berechtigungen', href: '/admin/settings/permissions', icon: 'lock' },
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

  if (!session || !session.isHoldingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Sitzung wird geladen...</p>
          <a href="/login" className="text-blue-600 underline text-sm">Zur Anmeldung</a>
        </div>
      </div>
    )
  }

  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(' ') || session.profile.display_name

  const holdingName = 'Holding-Verwaltung'

  return (
    <>
      <AdminBar variant="holding-admin" label={holdingName} items={HOLDING_ADMIN_BAR_NAV} />
      <HoldingShell navItems={HOLDING_NAV_ITEMS} userName={displayName}>
        {children}
      </HoldingShell>
    </>
  )
}
