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
    return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)
  }

  // Find first permitted module for a direct link
  const firstModule = MODULE_PRIORITY.find(mod => session.permissions.includes(mod.permission))
  const targetPath = session.isHoldingAdmin ? '/dashboard' : (firstModule?.path ?? '/dashboard')

  return (
    <div className="p-8 text-center">
      <p className="text-gray-500 mb-4">Weiterleitung...</p>
      <a href={targetPath} className="text-blue-600 underline">
        Zum Dashboard
      </a>
      <script dangerouslySetInnerHTML={{ __html: `window.location.href="${targetPath}"` }} />
    </div>
  )
}
