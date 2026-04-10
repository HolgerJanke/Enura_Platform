import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PlatformBillingPage() {
  const session = await getSession()
  if (!session?.isEnuraAdmin) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Zugriff verweigert.</p></div>)
  }

  let subscriptions: Array<Record<string, unknown>> = []

  try {
    const supabase = createSupabaseServerClient()
    const { data } = await supabase
      .from('holding_subscriptions')
      .select('*, holdings(name, slug)')
      .order('created_at', { ascending: false })

    subscriptions = (data ?? []) as Array<Record<string, unknown>>
  } catch { /* silently handle */ }

  const PLAN_LABELS: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    scale: 'Scale',
    enterprise: 'Enterprise',
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Abrechnung</h1>
      <p className="text-sm text-gray-500 mb-8">
        Subscription-Plaene und Nutzungsuebersicht pro Holding.
      </p>

      {subscriptions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">Keine Subscriptions vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Holding</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Zyklus</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Max Companies</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Max User/Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">KI-Calls</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Testphase endet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {subscriptions.map((sub, i) => {
                const holding = sub['holdings'] as Record<string, unknown> | null
                return (
                  <tr key={String(sub['id'] ?? i)}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {holding ? String(holding['name'] ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {PLAN_LABELS[String(sub['plan'] ?? '')] ?? String(sub['plan'] ?? '—')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {sub['billing_cycle'] === 'annual' ? 'Jaehrlich' : 'Monatlich'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center">{String(sub['max_companies'] ?? '—')}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center">{String(sub['max_users_per_company'] ?? '—')}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {sub['ai_calls_enabled'] ? '✓ Aktiv' : '✗ Deaktiviert'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {sub['trial_ends_at'] ? new Date(String(sub['trial_ends_at'])).toLocaleDateString('de-CH') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
