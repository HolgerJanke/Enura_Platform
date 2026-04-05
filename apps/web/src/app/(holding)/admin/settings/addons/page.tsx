import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AddonsClient } from './addons-client'

export default async function AddonsPage() {
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Kein Zugriff.</p>
        <Link href="/dashboard" className="text-blue-600 underline text-sm mt-2 inline-block">
          Zum Dashboard
        </Link>
      </div>
    )
  }

  const supabase = createSupabaseServerClient()

  // Fetch holding subscription
  const { data: sub } = await supabase
    .from('holding_subscriptions')
    .select('finanzplanung_enabled')
    .eq('holding_id', session.holdingId ?? '')
    .maybeSingle()

  const holdingEnabled = sub?.finanzplanung_enabled === true

  // Fetch companies with their feature flags
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('holding_id', session.holdingId ?? '')
    .eq('status', 'active')
    .order('name')

  const companyList = (companies ?? []) as Array<{ id: string; name: string; slug: string }>

  // Fetch feature flags for each company
  const companyIds = companyList.map((c) => c.id)
  const { data: flagRows } = companyIds.length > 0
    ? await supabase
        .from('company_feature_flags')
        .select('company_id, finanzplanung_enabled')
        .in('company_id', companyIds)
    : { data: [] }

  const flagMap = new Map(
    ((flagRows ?? []) as Array<{ company_id: string; finanzplanung_enabled: boolean }>).map(
      (f) => [f.company_id, f.finanzplanung_enabled],
    ),
  )

  const companiesWithFlags = companyList.map((c) => ({
    ...c,
    finanzplanung_enabled: flagMap.get(c.id) ?? false,
  }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Add-on Module</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Zusaetzliche Module fuer Ihre Holding und deren Unternehmen verwalten.
      </p>

      <AddonsClient holdingEnabled={holdingEnabled} companies={companiesWithFlags} />
    </div>
  )
}
