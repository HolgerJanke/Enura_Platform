'use server'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireHoldingSession() {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin) throw new Error('Kein Zugriff')
  if (!session.holdingId) {
    throw new Error('Kein Holding zugewiesen.')
  }
  return { session, holdingId: session.holdingId }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompanyKpi = {
  companyId: string
  companyName: string
  totalLeads: number
  wonOffers: number
  revenue: number
  aiCallsAnalysed: number
  activeUsers: number
}

export type HoldingKpiSummary = {
  totalLeads: number
  totalWonOffers: number
  totalRevenue: number
  totalAiCalls: number
  totalActiveUsers: number
  totalCompanies: number
  companyKpis: CompanyKpi[]
  anomalies: AnomalySummary[]
  compliance: ComplianceSummary
}

export type AnomalySummary = {
  companyName: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export type ComplianceSummary = {
  totalChecks: number
  fulfilled: number
  pending: number
  overdue: number
}

// ---------------------------------------------------------------------------
// getHoldingKpis — aggregates across all companies
// ---------------------------------------------------------------------------

export async function getHoldingKpis(
  periodDays: number,
): Promise<HoldingKpiSummary> {
  const { holdingId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const since = new Date()
  since.setDate(since.getDate() - periodDays)
  const sinceStr = since.toISOString()

  // Fetch companies
  const { data: companiesRaw } = await supabase
    .from('companies')
    .select('id, name')
    .eq('holding_id', holdingId)
    .eq('status', 'active')
    .order('name')

  const companies = (companiesRaw ?? []) as Array<{ id: string; name: string }>
  const companyIds = companies.map((c) => c.id)

  if (companyIds.length === 0) {
    return {
      totalLeads: 0,
      totalWonOffers: 0,
      totalRevenue: 0,
      totalAiCalls: 0,
      totalActiveUsers: 0,
      totalCompanies: 0,
      companyKpis: [],
      anomalies: [],
      compliance: { totalChecks: 0, fulfilled: 0, pending: 0, overdue: 0 },
    }
  }

  // Build per-company KPIs
  const companyKpis: CompanyKpi[] = await Promise.all(
    companies.map(async (company) => {
      // Leads count
      const { count: leadCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .gte('created_at', sinceStr)

      // Won offers
      const { count: wonCount } = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('status', 'won')
        .gte('created_at', sinceStr)

      // Revenue from won offers
      const { data: revenueData } = await supabase
        .from('offers')
        .select('value')
        .eq('company_id', company.id)
        .eq('status', 'won')
        .gte('created_at', sinceStr)

      const revenue = (revenueData ?? []).reduce(
        (sum, o) => sum + (Number((o as Record<string, unknown>).value) || 0),
        0,
      )

      // AI calls analysed
      const { count: aiCallCount } = await supabase
        .from('call_analysis')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .gte('created_at', sinceStr)

      // Active users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('is_active', true)

      return {
        companyId: company.id,
        companyName: company.name,
        totalLeads: leadCount ?? 0,
        wonOffers: wonCount ?? 0,
        revenue,
        aiCallsAnalysed: aiCallCount ?? 0,
        activeUsers: userCount ?? 0,
      }
    }),
  )

  // Aggregates
  const totalLeads = companyKpis.reduce((s, c) => s + c.totalLeads, 0)
  const totalWonOffers = companyKpis.reduce((s, c) => s + c.wonOffers, 0)
  const totalRevenue = companyKpis.reduce((s, c) => s + c.revenue, 0)
  const totalAiCalls = companyKpis.reduce((s, c) => s + c.aiCallsAnalysed, 0)
  const totalActiveUsers = companyKpis.reduce((s, c) => s + c.activeUsers, 0)

  // Anomalies — simple detection: companies with zero activity in the period
  const anomalies: AnomalySummary[] = []
  for (const kpi of companyKpis) {
    if (kpi.totalLeads === 0 && periodDays >= 30) {
      anomalies.push({
        companyName: kpi.companyName,
        description: `Keine neuen Leads in den letzten ${periodDays} Tagen`,
        severity: 'high',
      })
    }
    if (kpi.wonOffers === 0 && kpi.totalLeads > 5) {
      anomalies.push({
        companyName: kpi.companyName,
        description: `${kpi.totalLeads} Leads, aber keine gewonnenen Angebote`,
        severity: 'medium',
      })
    }
  }

  // Compliance summary
  const { count: totalChecks } = await supabase
    .from('compliance_checks')
    .select('id', { count: 'exact', head: true })
    .eq('holding_id', holdingId)

  const { count: fulfilledChecks } = await supabase
    .from('compliance_checks')
    .select('id', { count: 'exact', head: true })
    .eq('holding_id', holdingId)
    .eq('status', 'fulfilled')

  const { count: overdueChecks } = await supabase
    .from('compliance_checks')
    .select('id', { count: 'exact', head: true })
    .eq('holding_id', holdingId)
    .eq('status', 'overdue')

  const compliance: ComplianceSummary = {
    totalChecks: totalChecks ?? 0,
    fulfilled: fulfilledChecks ?? 0,
    overdue: overdueChecks ?? 0,
    pending: (totalChecks ?? 0) - (fulfilledChecks ?? 0) - (overdueChecks ?? 0),
  }

  return {
    totalLeads,
    totalWonOffers,
    totalRevenue,
    totalAiCalls,
    totalActiveUsers,
    totalCompanies: companies.length,
    companyKpis,
    anomalies,
    compliance,
  }
}
