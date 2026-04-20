export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PlatformReportsPage() {
  const session = await getSession()
  if (!session?.isEnuraAdmin) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Zugriff verweigert.</p></div>)
  }

  let holdingCount = 0
  let companyCount = 0
  let reportCount = 0

  try {
    const supabase = createSupabaseServerClient()
    const { count: hc } = await supabase.from('holdings').select('id', { count: 'exact', head: true })
    holdingCount = hc ?? 0
    const { count: cc } = await supabase.from('companies').select('id', { count: 'exact', head: true })
    companyCount = cc ?? 0
    const { count: rc } = await supabase.from('daily_reports').select('id', { count: 'exact', head: true })
    reportCount = rc ?? 0
  } catch { /* silently handle */ }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Plattform-Berichte</h1>
      <p className="text-sm text-gray-500 mb-8">
        Uebergreifende Berichte und KPI-Aggregation über alle Holdings und Companies.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Holdings</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{holdingCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Companies</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{companyCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Tagesberichte generiert</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{reportCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-gray-500">Detaillierte Cross-Holding-Berichte werden in einer kuenftigen Version verfügbar sein.</p>
      </div>
    </div>
  )
}
