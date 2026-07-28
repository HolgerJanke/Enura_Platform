export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HoldingAddonsClient } from './addons-client'

/**
 * Holding per-company add-on ACTIVATION view.
 *
 * The Enura cross-holding LICENSING view that used to live here was moved to
 * `/platform/addons` (finding C5) — Enura-only surfaces belong under
 * `/platform`, where the middleware's `isEnuraAdmin` gate covers them. This
 * page is now Holding-admin-only, matching its `/admin` route (Holding tier
 * in `ROUTE_RULES`); a pure Enura admin has no cross-holding view here
 * anymore and must use `/platform/addons` instead.
 */
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

  const { data: sub } = await supabase
    .from('holding_subscriptions')
    .select('finanzplanung_enabled')
    .eq('holding_id', session.holdingId ?? '')
    .maybeSingle()

  const holdingEnabled = sub?.finanzplanung_enabled === true

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('holding_id', session.holdingId ?? '')
    .eq('status', 'active')
    .order('name')

  const companyList = (companies ?? []) as Array<{ id: string; name: string; slug: string }>

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
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Add-on Module</h1>
      <p className="text-sm text-gray-500 mb-8">
        Zusätzliche Module für Ihre Holding und deren Unternehmen verwalten.
      </p>
      <HoldingAddonsClient holdingEnabled={holdingEnabled} companies={companiesWithFlags} />
    </div>
  )
}
