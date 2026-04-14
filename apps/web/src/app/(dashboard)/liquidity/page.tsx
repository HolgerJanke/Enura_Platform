export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { LiquidityRedirect } from './redirect-client'

export default async function LiquidityPage() {
  const session = await getSession()

  if (!session?.companyId) {
    return (<div className="p-8 text-center"><a href="/dashboard" className="text-blue-600 underline">Zum Dashboard</a></div>)
  }

  return <LiquidityRedirect companyId={session.companyId} />
}
