import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

const MODULE_PRIORITY = [
  { permission: 'module:setter:read', path: '/setter' },
  { permission: 'module:berater:read', path: '/berater' },
  { permission: 'module:leads:read', path: '/leads' },
  { permission: 'module:innendienst:read', path: '/innendienst' },
  { permission: 'module:bau:read', path: '/projects' },
  { permission: 'module:finance:read', path: '/finance' },
]

export default async function DashboardRootPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Holding admins go to dashboard overview
  if (session.isHoldingAdmin) redirect('/dashboard')

  // Find first permitted module
  for (const mod of MODULE_PRIORITY) {
    if (session.permissions.includes(mod.permission)) {
      redirect(mod.path)
    }
  }

  // No permissions — show access denied page
  redirect('/dashboard')
}
