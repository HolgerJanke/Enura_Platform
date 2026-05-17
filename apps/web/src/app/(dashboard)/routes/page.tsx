export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

type RoutePlan = {
  id: string
  rep_id: string
  plan_date: string
  stops: string
  total_distance_km: number
  status: string
  created_at: string
}

type RouteSuggestion = {
  id: string
  lead_id: string
  anchor_address: string
  distance_km: number
  suggested_for: string
  status: string
}

type Stop = {
  order: number
  lead_id: string
  name: string
  address: string
  plz: string
  distance_km: number
  phone: string | null
}

export default async function RoutesPage() {
  const session = await getSession()
  if (!session?.companyId) return null

  const db = createSupabaseServiceClient()
  const cid = session.companyId
  const today = new Date().toISOString().split('T')[0]

  const [plansResult, suggestionsResult, configResult] = await Promise.all([
    db.from('route_plans')
      .select('*')
      .eq('company_id', cid)
      .gte('plan_date', today)
      .order('plan_date', { ascending: true })
      .order('total_distance_km', { ascending: true })
      .limit(20),
    db.from('route_suggestions')
      .select('*')
      .eq('company_id', cid)
      .eq('status', 'pending')
      .gte('suggested_for', today)
      .order('distance_km', { ascending: true })
      .limit(30),
    db.from('route_bot_config')
      .select('is_active, radius_km, min_leads_for_suggestion, working_hours_start, working_hours_end')
      .eq('company_id', cid)
      .single(),
  ])

  const plans = (plansResult.data ?? []) as RoutePlan[]
  const suggestions = (suggestionsResult.data ?? []) as RouteSuggestion[]
  const config = configResult.data

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Routen</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Optimierte Tagesrouten und Lead-Vorschläge vom Route-Bot
        </p>
      </div>

      {/* Status Banner */}
      {config && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${config.is_active ? 'border-green-200 bg-green-50 text-green-800' : 'border-yellow-200 bg-yellow-50 text-yellow-800'}`}>
          {config.is_active ? (
            <span>Route-Bot aktiv &mdash; Radius {config.radius_km} km, min. {config.min_leads_for_suggestion} Leads, {config.working_hours_start?.slice(0, 5)}&ndash;{config.working_hours_end?.slice(0, 5)}</span>
          ) : (
            <span>Route-Bot ist deaktiviert. Aktivierung über die Konfiguration.</span>
          )}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Aktive Routen" value={plans.length} />
        <KpiCard label="Offene Vorschläge" value={suggestions.length} />
        <KpiCard label="Leads in Routen" value={plans.reduce((sum, p) => sum + (JSON.parse(p.stops) as Stop[]).length, 0)} />
        <KpiCard label="Gesamtdistanz" value={`${plans.reduce((sum, p) => sum + p.total_distance_km, 0).toFixed(1)} km`} />
      </div>

      {/* Route Plans */}
      <section>
        <h2 className="text-lg font-semibold text-brand-text-primary mb-3">Tagesrouten</h2>
        {plans.length === 0 ? (
          <EmptyState message="Keine aktiven Routen. Der Bot generiert neue Routen basierend auf Lead-Dichte." />
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => {
              const stops: Stop[] = JSON.parse(plan.stops)
              return (
                <div key={plan.id} className="rounded-lg border border-brand-border bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-brand-text-primary">
                        {new Date(plan.plan_date).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <StatusBadge status={plan.status} />
                    </div>
                    <span className="text-xs text-brand-text-secondary">{plan.total_distance_km} km total</span>
                  </div>
                  <div className="space-y-2">
                    {stops.map((stop, idx) => (
                      <div key={stop.lead_id} className="flex items-center gap-3 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-brand-text-primary">{stop.name}</span>
                          <span className="text-brand-text-secondary ml-2">{stop.address}</span>
                        </div>
                        <span className="text-xs text-brand-text-secondary whitespace-nowrap">{stop.distance_km} km</span>
                        {stop.phone && (
                          <a href={`tel:${stop.phone}`} className="text-xs text-brand-primary hover:underline whitespace-nowrap">
                            {stop.phone}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Suggestions */}
      <section>
        <h2 className="text-lg font-semibold text-brand-text-primary mb-3">Vorschläge in der Nähe</h2>
        {suggestions.length === 0 ? (
          <EmptyState message="Keine offenen Vorschläge. Der Bot schlägt Leads in der Nähe bestehender Termine vor." />
        ) : (
          <div className="rounded-lg border border-brand-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-brand-border">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-brand-text-secondary">Anker-Adresse</th>
                  <th className="text-left px-4 py-2 font-medium text-brand-text-secondary">Entfernung</th>
                  <th className="text-left px-4 py-2 font-medium text-brand-text-secondary">Vorgeschlagen für</th>
                  <th className="text-left px-4 py-2 font-medium text-brand-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {suggestions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-brand-text-primary">{s.anchor_address}</td>
                    <td className="px-4 py-2 text-brand-text-secondary">{s.distance_km} km</td>
                    <td className="px-4 py-2 text-brand-text-secondary">
                      {new Date(s.suggested_for).toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-brand-border bg-white p-4">
      <p className="text-xs text-brand-text-secondary">{label}</p>
      <p className="text-2xl font-bold text-brand-text-primary mt-1">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-50 text-green-700',
    pending: 'bg-yellow-50 text-yellow-700',
    completed: 'bg-blue-50 text-blue-700',
    accepted: 'bg-green-50 text-green-700',
    declined: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-brand-border bg-gray-50/50 p-8 text-center">
      <svg className="mx-auto h-10 w-10 text-brand-text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      <p className="mt-3 text-sm text-brand-text-secondary">{message}</p>
    </div>
  )
}
