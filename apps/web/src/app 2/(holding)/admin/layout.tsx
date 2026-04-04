import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { HoldingShell } from '@/components/holding-shell'

const HOLDING_NAV_ITEMS = [
  { label: 'Unternehmen', href: '/admin', icon: 'building' },
  { label: 'Benutzer', href: '/admin/users', icon: 'users' },
]

export default async function HoldingAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isHoldingAdmin) redirect('/login')

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
