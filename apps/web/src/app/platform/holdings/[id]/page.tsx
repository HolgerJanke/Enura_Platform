import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireEnuraAdmin } from '@/lib/permissions'
import { HoldingDetailClient } from './holding-detail-client'
import type { HoldingRow, CompanyRow } from '@enura/types'

type HoldingSubscription = {
  id: string
  holding_id: string
  plan: string
  company_plan: string
  billing_cycle: string
  ai_calls_enabled: boolean
  process_builder_enabled: boolean
  liquidity_enabled: boolean
  max_companies: number
  max_users_per_company: number
  trial_ends_at: string | null
  activated_at: string | null
  notes: string | null
}

async function getHoldingDetail(holdingId: string) {
  const supabase = createSupabaseServerClient()

  const { data: holding } = await supabase
    .from('holdings')
    .select('*')
    .eq('id', holdingId)
    .single()

  if (!holding) return null

  const [companiesRes, subscriptionRes, usersRes] = await Promise.all([
    supabase
      .from('companies')
      .select('*')
      .eq('holding_id', holdingId)
      .order('created_at', { ascending: false }),
    supabase
      .from('holding_subscriptions')
      .select('*')
      .eq('holding_id', holdingId)
      .single(),
    supabase
      .from('profiles')
      .select('id')
      .eq('holding_id', holdingId),
  ])

  return {
    holding: holding as HoldingRow,
    companies: (companiesRes.data ?? []) as CompanyRow[],
    subscription: subscriptionRes.data as HoldingSubscription | null,
    totalUsers: (usersRes.data ?? []).length,
  }
}

export default async function HoldingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  await requireEnuraAdmin()

  const detail = await getHoldingDetail(params.id)
  if (!detail) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurueck</a></div>)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{detail.holding.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Slug: {detail.holding.slug}</p>
      </div>

      <HoldingDetailClient
        holding={detail.holding}
        companies={detail.companies}
        subscription={detail.subscription}
        totalUsers={detail.totalUsers}
      />
    </div>
  )
}
