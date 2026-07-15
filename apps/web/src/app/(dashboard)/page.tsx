export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { resolveLandingPath } from '@/lib/landing'

export default async function DashboardRootPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const targetPath = resolveLandingPath(session)

  redirect(targetPath)
}
