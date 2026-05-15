export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { listBotsSafe, getBotHealthSafe } from '@/lib/bot-client'
import type { BotManifestInfo } from '@/lib/bot-client'

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  tier1: { label: 'MVP', color: 'bg-green-50 text-green-700' },
  tier2: { label: 'Standard', color: 'bg-blue-50 text-blue-700' },
  tier3: { label: 'Branche', color: 'bg-purple-50 text-purple-700' },
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

  // Preview bots to show in "coming soon" state
  const previewBots = [
    { name: 'Rechnungsprüfer', description: 'Prüft eingehende Rechnungen automatisch auf Vollständigkeit, Duplikate und Abweichungen.', tier: 'tier1', connectors: ['Bexio'] },
    { name: 'Cashflow-Prognose', description: 'Erstellt wöchentliche Cashflow-Prognosen basierend auf offenen Rechnungen und geplanten Ausgaben.', tier: 'tier1', connectors: ['Bexio'] },
    { name: 'Lead-Qualifizierer', description: 'Bewertet eingehende Leads automatisch anhand von Kriterien wie PLZ, Dachfläche und Energieverbrauch.', tier: 'tier2', connectors: ['Reonic', 'LeadNotes'] },
    { name: 'Angebots-Nachfasser', description: 'Erkennt unbeantwortete Angebote und erstellt personalisierte Follow-up-Vorschläge.', tier: 'tier2', connectors: ['Bexio', '3CX'] },
    { name: 'Anomalie-Wächter', description: 'Überwacht KPIs und meldet ungewöhnliche Abweichungen in Echtzeit an das Team.', tier: 'tier1', connectors: [] },
    { name: 'Montage-Planer', description: 'Optimiert Montagetermine basierend auf Teamverfügbarkeit, Standort und Materiallager.', tier: 'tier3', connectors: ['Google Calendar'] },
  ]

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
                <h2 className="text-base font-semibold text-gray-900">Intelligente Automatisierungen</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Bots automatisieren wiederkehrende Aufgaben wie Rechnungsprüfung, Lead-Qualifizierung und Cashflow-Prognosen.
                  Sie nutzen Ihre verbundenen Connectoren und lernen aus Ihren Daten.
                </p>
                <p className="text-xs text-blue-600 font-medium mt-3">
                  Verfügbar im nächsten Release
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewBots.map((bot) => (
              <div
                key={bot.name}
                className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100 opacity-75"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5" />
                    </svg>
                  </div>
                  <TierBadge tier={bot.tier} />
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
    </div>
  )
}
