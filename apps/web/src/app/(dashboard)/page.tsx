export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { resolveLandingPath } from '@/lib/landing'

export default async function DashboardRootPage() {
  const session = await getSession()
  if (!session) {
    return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)
  }

  // Enura/holding admins have no company to render, so they belong on their own
  // console rather than the company dashboard (which renders blank without one).
  const targetPath = resolveLandingPath(session)

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
