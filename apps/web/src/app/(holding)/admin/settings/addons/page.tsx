export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { EnuraAddonsClient, HoldingAddonsClient } from './addons-client'

export default async function AddonsPage() {
  const session = await getSession()
  if (!session || (!session.isHoldingAdmin && !session.isEnuraAdmin)) {
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

  // ── Enura Admin View: show all holdings ──
  if (session.isEnuraAdmin) {
    const { data: holdings } = await supabase
      .from('holdings')
      .select('id, name')
      .order('name')

    const holdingList = (holdings ?? []) as Array<{ id: string; name: string }>

    // Fetch subscription flags for each holding
    const holdingIds = holdingList.map((h) => h.id)
    const { data: subs } = holdingIds.length > 0
      ? await supabase
          .from('holding_subscriptions')
          .select('holding_id, finanzplanung_enabled')
          .in('holding_id', holdingIds)
      : { data: [] }

    const subMap = new Map(
      ((subs ?? []) as Array<{ holding_id: string; finanzplanung_enabled: boolean }>).map(
        (s) => [s.holding_id, s.finanzplanung_enabled],
      ),
    )

    const holdingsWithFlags = holdingList.map((h) => ({
      ...h,
      finanzplanung_enabled: subMap.get(h.id) ?? false,
    }))

    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Add-on Module</h1>
        <p className="text-sm text-gray-500 mb-8">
          Module pro Holding lizenzieren. Nach der Lizenzierung kann der Holding-Admin das Modul pro Unternehmen aktivieren.
        </p>
        <EnuraAddonsClient holdings={holdingsWithFlags} />
      </div>
    )
  }

  // ── Holding Admin View: show companies in their holding ──
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
