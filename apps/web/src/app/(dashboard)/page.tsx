export const dynamic = 'force-dynamic'

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
  if (!session) {
    redirect('/login')
  }

  const firstModule = MODULE_PRIORITY.find(mod => session.permissions.includes(mod.permission))
  const targetPath = session.isHoldingAdmin ? '/dashboard' : (firstModule?.path ?? '/dashboard')

  redirect(targetPath)
}
