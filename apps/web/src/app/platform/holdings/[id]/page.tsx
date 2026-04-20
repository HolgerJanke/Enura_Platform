export const dynamic = 'force-dynamic'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireEnuraAdmin } from '@/lib/permissions'
import { HoldingDetailClient } from './holding-detail-client'
import { HoldingAdminManager } from './holding-admin-manager'
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

  // Step 1: fetch companies and subscription in parallel
  const [companiesRes, subscriptionRes, adminsRes] = await Promise.all([
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
      .from('holding_admins_v2')
      .select('profile_id, is_owner')
      .eq('holding_id', holdingId),
  ])

  // Step 2: fetch all users belonging to companies in this holding
  const companyIds = (companiesRes.data ?? []).map((c: Record<string, unknown>) => c['id'] as string)
  const usersRes = companyIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, first_name, last_name, display_name, company_id')
        .eq('is_active', true)
        .in('company_id', companyIds)
        .order('last_name')
    : { data: [] }

  const users = (usersRes.data ?? []) as Array<{
    id: string; first_name: string | null; last_name: string | null;
    display_name: string; company_id: string | null
  }>
  const adminProfileIds = new Set(
    ((adminsRes.data ?? []) as Array<{ profile_id: string }>).map((a) => a.profile_id),
  )

  return {
    holding: holding as HoldingRow,
    companies: (companiesRes.data ?? []) as CompanyRow[],
    subscription: subscriptionRes.data as HoldingSubscription | null,
    totalUsers: users.length,
    users,
    adminProfileIds: Array.from(adminProfileIds),
  }
}

export default async function HoldingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  await requireEnuraAdmin()

  const detail = await getHoldingDetail(params.id)
  if (!detail) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurück</a></div>)

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

      {/* Admin management */}
      <div className="mt-8">
        <HoldingAdminManager
          holdingId={detail.holding.id}
          users={detail.users}
          adminProfileIds={detail.adminProfileIds}
        />
      </div>
    </div>
  )
}
