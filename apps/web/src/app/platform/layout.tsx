export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
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

  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(' ') || session.profile.display_name

  return (
    <PlatformShell navItems={PLATFORM_NAV_ITEMS} userName={displayName}>
      {children}
    </PlatformShell>
  )
}
