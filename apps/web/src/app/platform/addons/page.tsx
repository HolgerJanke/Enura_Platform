export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { EnuraAddonsClient } from './addons-client'

/**
 * Enura Group cross-holding add-on LICENSING view (finding C5).
 *
 * Relocated here from `(holding)/admin/settings/addons` — that route is
 * Holding-tier in `ROUTE_RULES` and per OD-2 Enura-only surfaces belong under
 * `/platform`, where the middleware's `isEnuraAdmin` gate actually covers
 * them. The Holding per-company ACTIVATION view stays at
 * `/admin/settings/addons`, now Holding-admin-only.
 */
export default async function PlatformAddonsPage() {
  const session = await getSession()

  // Defensive check: middleware already gates `/platform` to isEnuraAdmin,
  // but this page also renders a mutating server action
  // (`toggleHoldingFinanzplanung`), so the check is re-verified here too
  // (CLAUDE.md §4.2 — auth gates must hold server-side, never client-only).
  if (!session?.isEnuraAdmin) {
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
