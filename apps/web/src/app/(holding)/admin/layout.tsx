import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { HoldingShell } from '@/components/holding-shell'

const HOLDING_NAV_ITEMS = [
  { label: 'Unternehmen', href: '/admin', icon: 'building' },
  { label: 'Benutzer', href: '/admin/users', icon: 'users' },
  { label: 'Finanzen', href: '/admin/finance', icon: 'banknote' },
  { label: 'Secrets', href: '/admin/secrets', icon: 'key' },
  { label: 'Tools', href: '/admin/tools', icon: 'wrench' },
  { label: 'Compliance', href: '/admin/compliance', icon: 'shield-check' },
  { label: 'Analytics', href: '/admin/analytics', icon: 'bar-chart' },
  { label: 'Prozesse', href: '/admin/processes', icon: 'workflow' },
  { label: 'Hilfe', href: '/help', icon: 'help-circle' },
]

export default async function HoldingAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // Don't call redirect() in layouts — it causes 404 on Vercel
  // The middleware handles auth redirects
  if (!session || !session.isHoldingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Sitzung wird geladen...</p>
          <a href="/login" className="text-blue-600 underline text-sm">
            Zur Anmeldung
          </a>
        </div>
      </div>
    )
  }

  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(' ') || session.profile.display_name

  return (
    <HoldingShell
      navItems={HOLDING_NAV_ITEMS}
      userName={displayName}
    >
      {children}
    </HoldingShell>
  )
}
