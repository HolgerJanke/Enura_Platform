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

  const [bots, health] = await Promise.all([
    listBotsSafe(),
    getBotHealthSafe(),
  ])

  const apiOnline = health !== null
  const grouped = {
    tier1: bots.filter((b) => b.tier === 'tier1'),
    tier2: bots.filter((b) => b.tier === 'tier2'),
    tier3: bots.filter((b) => b.tier === 'tier3'),
  }

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
      </div>

      {/* Offline banner */}
      {!apiOnline && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-lg mt-0.5">&#9888;</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">Bot API nicht erreichbar</p>
              <p className="text-xs text-yellow-700 mt-1">
                Die Bot API unter <code className="rounded bg-yellow-100 px-1.5 py-0.5 text-[11px]">{process.env.ENURA_BOTS_API_URL ?? 'http://localhost:4000'}</code> antwortet nicht.
                Stellen Sie sicher, dass der Service läuft.
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
