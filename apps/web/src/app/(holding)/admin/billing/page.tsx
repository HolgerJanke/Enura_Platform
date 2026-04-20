export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  scale: 'Scale',
  enterprise: 'Enterprise',
}

export default async function HoldingBillingPage() {
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Kein Zugriff.</p></div>)
  }

  let subscription: Record<string, unknown> | null = null
  let companies: Array<Record<string, unknown>> = []

  try {
    const supabase = createSupabaseServerClient()

    const { data: sub } = await supabase
      .from('holding_subscriptions')
      .select('*')
      .eq('holding_id', session.holdingId ?? '')
      .maybeSingle()
    subscription = sub as Record<string, unknown> | null

    const { data: comps } = await supabase
      .from('companies')
      .select('id, name, slug, status')
      .eq('holding_id', session.holdingId ?? '')
      .order('name')
    companies = (comps ?? []) as Array<Record<string, unknown>>
  } catch {
    // silently handle
  }

  const plan = String(subscription?.['plan'] ?? 'professional')
  const billing = String(subscription?.['billing_cycle'] ?? 'monthly')
  const maxCompanies = Number(subscription?.['max_companies'] ?? 10)
  const maxUsers = Number(subscription?.['max_users_per_company'] ?? 30)
  const aiEnabled = Boolean(subscription?.['ai_calls_enabled'] ?? true)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Abrechnung</h1>
      <p className="text-sm text-gray-500 mb-8">
        Übersicht über Ihr Abonnement und die Nutzung durch Ihre Unternehmen.
      </p>

      {/* Subscription Overview */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ihr Abonnement</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Plan</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {PLAN_LABELS[plan] ?? plan}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Abrechnungszyklus</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {billing === 'annual' ? 'Jaehrlich' : 'Monatlich'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Max. Unternehmen</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {companies.length} / {maxCompanies}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">KI-Anrufe</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {aiEnabled ? 'Aktiviert' : 'Deaktiviert'}
            </p>
          </div>
        </div>
      </div>

      {/* What Enura charges the Holding */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Kosten von Enura Group</h2>
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Position</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Plattform-Lizenz ({PLAN_LABELS[plan] ?? plan})</td>
                <td className="px-4 py-3 text-sm text-gray-700 text-right">Gem. Vertrag</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Unternehmen ({companies.length} aktiv)</td>
                <td className="px-4 py-3 text-sm text-gray-700 text-right">Gem. Vertrag</td>
              </tr>
              {aiEnabled && (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-900">KI-Anrufanalyse (nutzungsabhaengig)</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">Gem. Nutzung</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">Detaillierte Rechnungen werden per E-Mail zugestellt.</p>
      </div>

      {/* What the Holding bills to Companies */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Zuordnung an Unternehmen</h2>
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Unternehmen</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Max. Benutzer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map((c, i) => (
                <tr key={String(c['id'] ?? i)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{String(c['name'] ?? '—')}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{String(c['slug'] ?? '—')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      c['status'] === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c['status'] === 'active' ? 'Aktiv' : String(c['status'] ?? '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{maxUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
