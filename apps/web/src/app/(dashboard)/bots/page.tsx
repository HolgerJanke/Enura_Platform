export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { listBotsSafe, getBotHealthSafe } from '@/lib/bot-client'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import type { BotManifestInfo } from '@/lib/bot-client'

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  tier1: { label: 'Core', color: 'bg-green-50 text-green-700' },
  tier2: { label: 'Multi-Channel', color: 'bg-blue-50 text-blue-700' },
  tier3: { label: 'Custom', color: 'bg-purple-50 text-purple-700' },
}

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier] ?? { label: tier, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Connector pills
// ---------------------------------------------------------------------------

function ConnectorPills({ required, optional }: { required: string[]; optional: string[] }) {
  if (required.length === 0 && optional.length === 0) {
    return <span className="text-xs text-brand-text-secondary">Keine</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {required.map((c) => (
        <span key={c} className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
          {c}
        </span>
      ))}
      {optional.map((c) => (
        <span key={c} className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {c}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bot card
// ---------------------------------------------------------------------------

function BotCard({ bot }: { bot: BotManifestInfo }) {
  return (
    <Link
      href={`/bots/${bot.id}`}
      className="group rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-150"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.46 1.46a3.375 3.375 0 01-4.78 0L12 15.2l-.76.76a3.375 3.375 0 01-4.78 0L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5" />
          </svg>
        </div>
        <TierBadge tier={bot.tier} />
      </div>
      <h3 className="text-sm font-semibold text-brand-text-primary group-hover:text-brand-primary transition-colors">
        {bot.name}
      </h3>
      <p className="text-xs text-brand-text-secondary mt-1 line-clamp-2">
        {bot.description}
      </p>
      <div className="mt-3 pt-3 border-t border-gray-50">
        <p className="text-[10px] font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Connectoren</p>
        <ConnectorPills required={bot.requiredConnectors} optional={bot.optionalConnectors ?? []} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-brand-text-secondary">v{bot.version}</span>
        <span className="text-xs font-medium text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Testen &rarr;
        </span>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BotsPage() {
  const session = await getSession()
  if (!session) return null

  // If no Bot API URL is configured, show a clean "coming soon" state
  const botApiConfigured = !!process.env.ENURA_BOTS_API_URL

  const [bots, health] = botApiConfigured
    ? await Promise.all([listBotsSafe(), getBotHealthSafe()])
    : [[] as BotManifestInfo[], null]

  const apiOnline = health !== null
  const grouped = {
    tier1: bots.filter((b) => b.tier === 'tier1'),
    tier2: bots.filter((b) => b.tier === 'tier2'),
    tier3: bots.filter((b) => b.tier === 'tier3'),
  }

  // Real bots from alpen-energie-bots (running on Strato VPS)
  const previewBots = [
    { name: 'AB-Bot', description: 'Compliance-Prüfung: PVSol + Signed-Offer + Bildanalyse via Claude Vision. 4-Wege-Diff pro Deal, Approve/Stop an Berater.', tier: 'tier1', connectors: ['Reonic', 'Claude'], status: 'active' },
    { name: 'Lead-Checker', description: 'Tägliche Pipeline-Hygiene: Leads ohne Erstkontakt (2h), kein Update (48h), Eskalation (72h), stille Deals (>14d).', tier: 'tier1', connectors: ['Reonic', 'Telegram'], status: 'active' },
    { name: 'CEO-Bot', description: 'KPI-Aggregator: Pipeline-Verteilung, Won-Deals, offene Deals aus Reonic. Tägliches + stündliches Reporting.', tier: 'tier1', connectors: ['Reonic'], status: 'active' },
    { name: 'Ticket-Bot', description: 'Multi-Channel Ticket-System: Tag-Auswahl, Beschreibung, Auto-Routing an zuständige Person. Tickets landen in Vikunja.', tier: 'tier2', connectors: ['Telegram', 'WhatsApp', 'Vikunja'], status: 'active' },
    { name: 'Telegram-Bot', description: 'Worker für Berater-Benachrichtigungen, Compliance-Resultate, Approve/Stop-Buttons und Callback-Handling.', tier: 'tier1', connectors: ['Telegram'], status: 'active' },
    { name: 'WhatsApp-Bot', description: 'Webhook-Handler für eingehende WhatsApp-Nachrichten. Leitet Kundenanfragen an den Ticket-Flow weiter.', tier: 'tier2', connectors: ['WhatsApp'], status: 'planned' },
    { name: 'Route-Bot', description: 'Routenoptimierung für Vertriebler: Clustert offene Leads nach Nähe zu bestehenden Terminen. Spart Fahrzeit, maximiert Termindichte.', tier: 'tier2', connectors: ['Calendly', 'Bexio', 'Reonic'], status: 'active' },
  ]

  // Fetch live bot protocol data from Supabase
  const svc = createSupabaseServiceClient()
  const [logsResult, statusResult] = await Promise.all([
    svc.from('bot_logs').select('*').order('created_at', { ascending: false }).limit(30),
    svc.from('bot_status').select('*').order('last_heartbeat', { ascending: false }),
  ])
  const botLogs = (logsResult.data ?? []) as Array<{ id: string; bot_name: string; aktion: string; details: Record<string, unknown>; status: string; created_at: string }>
  const botStatuses = (statusResult.data ?? []) as Array<{ bot_name: string; status: string; last_heartbeat: string; last_action: string; last_action_at: string; last_error: string | null; details: Record<string, unknown> }>

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Bots</h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            Automatisierungen testen und steuern
          </p>
        </div>
        {botApiConfigured && (
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${apiOnline ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs font-medium text-brand-text-secondary">
              {apiOnline ? 'Bot API online' : 'Bot API offline'}
            </span>
            {apiOnline && health && (
              <span className="text-xs text-brand-text-secondary">
                &middot; {health.bots} Bots registriert
              </span>
            )}
          </div>
        )}
        {!botApiConfigured && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            In Entwicklung
          </span>
        )}
      </div>

      {/* Coming soon state — show preview cards */}
      {!botApiConfigured && (
        <>
          <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.46 1.46a3.375 3.375 0 01-4.78 0L12 15.2l-.76.76a3.375 3.375 0 01-4.78 0L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Alpen Energie Bots</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Diese Bots laufen bereits produktiv und automatisieren Compliance-Checks, Lead-Monitoring,
                  KPI-Reporting und Ticket-Management. Integration in die Plattform wird vorbereitet.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> 5 Bots aktiv auf VPS
                  </span>
                  <span className="text-xs text-gray-400">|</span>
                  <span className="text-xs text-blue-600 font-medium">
                    Plattform-Integration in Arbeit
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewBots.map((bot) => (
              <div
                key={bot.name}
                className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bot.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${bot.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${bot.status === 'active' ? 'bg-green-400' : 'bg-gray-300'}`} />
                      {bot.status === 'active' ? 'Aktiv' : 'Geplant'}
                    </span>
                    <TierBadge tier={bot.tier} />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-brand-text-primary">{bot.name}</h3>
                <p className="text-xs text-brand-text-secondary mt-1 line-clamp-2">{bot.description}</p>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-[10px] font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Connectoren</p>
                  <ConnectorPills required={bot.connectors} optional={[]} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Offline banner — only show when API is configured but unreachable */}
      {botApiConfigured && !apiOnline && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-lg mt-0.5">&#9888;</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">Bot API nicht erreichbar</p>
              <p className="text-xs text-yellow-700 mt-1">
                Die Bot API antwortet nicht. Stellen Sie sicher, dass der Service läuft.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bot grid by tier */}
      {apiOnline && bots.length > 0 && (
        <>
          {grouped.tier1.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-brand-text-primary">Tier 1 — MVP</h2>
                <span className="text-xs text-brand-text-secondary">Sofort einsatzbereit</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped.tier1.map((bot) => <BotCard key={bot.id} bot={bot} />)}
              </div>
            </section>
          )}

          {grouped.tier2.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-brand-text-primary">Tier 2 — Standard</h2>
                <span className="text-xs text-brand-text-secondary">Benötigen ggf. Connectoren</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped.tier2.map((bot) => <BotCard key={bot.id} bot={bot} />)}
              </div>
            </section>
          )}

          {grouped.tier3.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-brand-text-primary">Tier 3 — Branche</h2>
                <span className="text-xs text-brand-text-secondary">Branchenspezifisch</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped.tier3.map((bot) => <BotCard key={bot.id} bot={bot} />)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Empty state when API is online but no bots */}
      {apiOnline && bots.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-brand-sm border border-gray-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 mx-auto mb-4">
            <svg className="h-7 w-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-brand-text-primary">Keine Bots registriert</p>
          <p className="text-xs text-brand-text-secondary mt-1">
            Die API ist erreichbar, aber es sind noch keine Bots registriert.
          </p>
        </div>
      )}

      {/* Bot Status + Activity Protocol */}
      {botStatuses.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-brand-text-primary mb-3">Bot-Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {botStatuses.filter((s) => s.bot_name !== 'test-bot').map((s) => {
              const isOnline = s.last_heartbeat && (Date.now() - new Date(s.last_heartbeat).getTime()) < 24 * 60 * 60 * 1000
              const lastBeat = s.last_heartbeat ? new Date(s.last_heartbeat) : null
              const ago = lastBeat ? Math.floor((Date.now() - lastBeat.getTime()) / 60000) : null
              const agoText = ago !== null ? (ago < 60 ? `vor ${ago}m` : ago < 1440 ? `vor ${Math.floor(ago / 60)}h` : `vor ${Math.floor(ago / 1440)}d`) : '—'
              return (
                <div key={s.bot_name} className="rounded-lg bg-white p-4 border border-gray-100 shadow-brand-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-brand-text-primary capitalize">{s.bot_name}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${isOnline ? 'text-green-600' : 'text-red-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-brand-text-secondary">
                    <div className="flex justify-between"><span>Letzter Heartbeat</span><span className="font-medium">{agoText}</span></div>
                    {s.last_action && <div className="flex justify-between"><span>Letzte Aktion</span><span className="font-medium">{s.last_action}</span></div>}
                    {s.last_error && <div className="text-red-500 mt-1 truncate">{s.last_error}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {botLogs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-brand-text-primary">Aktivitätsprotokoll</h2>
            <span className="text-xs text-brand-text-secondary">{botLogs.length} Einträge</span>
          </div>
          <div className="rounded-xl bg-white shadow-brand-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-brand-text-secondary uppercase tracking-wide">Zeitpunkt</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-brand-text-secondary uppercase tracking-wide">Bot</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-brand-text-secondary uppercase tracking-wide">Aktion</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-brand-text-secondary uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-brand-text-secondary uppercase tracking-wide">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {botLogs.map((log) => {
                    const d = new Date(log.created_at)
                    const time = `${d.toLocaleDateString('de-CH')} ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`
                    const detailStr = log.details ? Object.entries(log.details).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${v}`).join(', ') : ''
                    return (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-xs text-brand-text-secondary whitespace-nowrap">{time}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text-primary capitalize">{log.bot_name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-brand-text-secondary">{log.aktion}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            log.status === 'success' ? 'bg-green-50 text-green-700' :
                            log.status === 'error' ? 'bg-red-50 text-red-700' :
                            'bg-yellow-50 text-yellow-700'
                          }`}>
                            {log.status === 'success' ? 'Erfolg' : log.status === 'error' ? 'Fehler' : log.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-brand-text-secondary max-w-[300px] truncate">{detailStr || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
