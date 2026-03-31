import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { PlatformShell } from '@/components/platform-shell'

const PLATFORM_NAV_ITEMS = [
  { label: 'Uebersicht', href: '/platform', icon: 'overview' },
  { label: 'Holdings', href: '/platform/holdings', icon: 'building' },
  { label: 'Gesundheit', href: '/platform/health', icon: 'health' },
  { label: 'Audit', href: '/platform/audit', icon: 'audit' },
]

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isEnuraAdmin) redirect('/login')

  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(' ') || session.profile.display_name

  return (
    <PlatformShell navItems={PLATFORM_NAV_ITEMS} userName={displayName}>
      {children}
    </PlatformShell>
  )
}
