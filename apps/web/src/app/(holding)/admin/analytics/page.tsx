export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { requireHoldingAdmin } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getHoldingKpis } from './actions'
import { AnalyticsClient } from './analytics-client'

export default async function AnalyticsPage() {
  await requireHoldingAdmin()

  const session = await getSession()
  if (!session?.holdingId) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

  // Default: 30 Tage
  const kpis = await getHoldingKpis(30)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytik</h1>
        <p className="mt-1 text-sm text-gray-500">
          Aggregierte KPIs und Unternehmensvergleiche über alle Gesellschaften im Holding.
        </p>
      </div>

      <AnalyticsClient initialKpis={kpis} />
    </div>
  )
}
