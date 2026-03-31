import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'

export default async function LiquidityPage() {
  await requirePermission('module:finance:read')
  const session = await getSession()

  if (!session?.companyId) {
    redirect('/dashboard')
  }

  redirect(`/liquidity/${session.companyId}`)
}
