export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { getBot, getBotStatus } from '@/lib/bot-client'
import { BotTestRunner } from './bot-test-runner'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------

const TIER_CONFIG: Record<string, { label: string; description: string; color: string }> = {
  tier1: { label: 'Tier 1 — MVP', description: 'Sofort einsatzbereit', color: 'bg-green-50 text-green-700' },
  tier2: { label: 'Tier 2 — Standard', description: 'Benötigt ggf. Connectoren', color: 'bg-blue-50 text-blue-700' },
  tier3: { label: 'Tier 3 — Branche', description: 'Branchenspezifisch', color: 'bg-purple-50 text-purple-700' },
}

// ---------------------------------------------------------------------------
// Example inputs per bot
// ---------------------------------------------------------------------------

const EXAMPLE_INPUTS: Record<string, Record<string, unknown>> = {
  'inbox-triage': {
    emails: [
      {
        id: 'mail-001',
        from: 'kunde@example.com',
        to: ['info@firma.ch'],
        subject: 'Frage zu unserem Vertrag',
        body: 'Hallo, ich hätte eine Frage zur Vertragsverlängerung. Können Sie mir die aktuellen Konditionen schicken?',
      },
    ],
  },
  'document-extract': {
    documents: [
      {
        filename: 'rechnung-2024-042.txt',
        contentType: 'text/plain',
        content: 'Rechnung Nr. RE-2024-042\nFirma Müller AG\nBernstrasse 15\n3001 Bern\nDatum: 15.03.2024\nBetrag: CHF 3450.00 inkl. 8.1% MwSt.\nZahlbar innert 30 Tagen',
      },
    ],
  },
  'customer-support': {
    question: 'Wie kann ich mein Passwort zurücksetzen?',
    knowledgeBase: [
      { id: 'kb-1', title: 'Passwort zurücksetzen', content: 'Klicken Sie auf "Passwort vergessen" auf der Login-Seite. Sie erhalten eine E-Mail mit einem Reset-Link.' },
      { id: 'kb-2', title: 'Account gesperrt', content: 'Nach 5 fehlgeschlagenen Versuchen wird Ihr Account für 15 Minuten gesperrt. Kontaktieren Sie den Support.' },
    ],
  },
  'onboarding': {
    customer: {
      name: 'Müller AG',
      address: 'Bernstrasse 15, 3001 Bern',
      contact: 'Hans Müller',
      email: 'h.mueller@mueller-ag.ch',
      phone: '+41 31 123 45 67',
    },
    targetSystems: ['crm', 'accounting'],
  },
  'follow-up': {
    targets: [
      {
        id: 'target-001',
        name: 'Müller AG',
        email: 'h.mueller@mueller-ag.ch',
        subject: 'Offene Rechnung RE-2024-042',
        context: 'Rechnung vom 15.03.2024 über CHF 3450.00, Zahlungsziel überschritten seit 14 Tagen',
        escalationLevel: 1,
      },
    ],
    dryRun: true,
  },
  'data-sync': {
    source: { system: 'crm', records: [{ id: 'c-001', name: 'Müller AG', city: 'Bern' }] },
    target: { system: 'accounting', records: [{ id: 'a-001', name: 'Mueller AG', city: 'Bern' }] },
    fieldMapping: { name: 'name', city: 'city' },
  },
  'report-generator': {
    title: 'Monatsbericht Mai 2024',
    sections: [
      { type: 'kpi', label: 'Umsatz', value: 125000, unit: 'CHF', change: 12.5 },
      { type: 'kpi', label: 'Neukunden', value: 8, change: -5 },
      { type: 'text', label: 'Zusammenfassung', content: 'Der Umsatz ist im Vergleich zum Vormonat um 12.5% gestiegen.' },
    ],
    format: 'markdown',
  },
  'appointment': {
    request: 'Ich brauche einen Termin nächste Woche Dienstag oder Mittwoch, am besten vormittags.',
    existingSlots: [
      { date: '2024-05-14', time: '09:00', duration: 60, available: true },
      { date: '2024-05-14', time: '10:00', duration: 60, available: false },
      { date: '2024-05-15', time: '09:00', duration: 60, available: true },
    ],
  },
  'employee-mgmt': {
    request: {
      type: 'vacation',
      employeeName: 'Lukas Weber',
      from: '2024-06-10',
      to: '2024-06-21',
      note: 'Sommerferien mit Familie',
    },
  },
  'inventory': {
    items: [
      { id: 'item-001', name: 'Wechselrichter SMA 10kW', stock: 3, minStock: 5, expiryDate: null },
      { id: 'item-002', name: 'Kabel 6mm² (100m)', stock: 12, minStock: 10, expiryDate: null },
      { id: 'item-003', name: 'Sicherungsautomat 32A', stock: 0, minStock: 8, expiryDate: null },
    ],
  },
  'billing': {
    timeEntries: [
      { date: '2024-05-01', hours: 4, rate: 150, description: 'Beratung und Setup', project: 'Müller AG' },
      { date: '2024-05-02', hours: 6, rate: 150, description: 'Implementation', project: 'Müller AG' },
    ],
    customer: { name: 'Müller AG', address: 'Bernstrasse 15, 3001 Bern' },
  },
  'tax-prep': {
    receipts: [
      { id: 'r-001', date: '2024-05-01', amount: 85.50, description: 'Büromaterial Papeterie', vendor: 'Papeterie AG' },
      { id: 'r-002', date: '2024-05-03', amount: 345.00, description: 'Software-Lizenz Adobe', vendor: 'Adobe Inc.' },
      { id: 'r-003', date: '2024-05-05', amount: 22.80, description: 'Geschäftsessen mit Kunde', vendor: 'Restaurant Löwen' },
    ],
  },
  'review-analysis': {
    reviews: [
      { id: 'rev-001', text: 'Sehr guter Service, schnelle Lieferung. Bin zufrieden!', rating: 5, source: 'google' },
      { id: 'rev-002', text: 'Produkt okay, aber die Kommunikation war schlecht. Musste 3x nachfragen.', rating: 2, source: 'google' },
      { id: 'rev-003', text: 'Top Beratung, faire Preise. Komme wieder!', rating: 4, source: 'google' },
    ],
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BotDetailPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = await params
  const session = await getSession()
  if (!session) return null

  let bot
  let status
  let error: string | null = null

  try {
    ;[bot, status] = await Promise.all([
      getBot(botId),
      getBotStatus(botId),
    ])
  } catch (e) {
    error = e instanceof Error ? e.message : 'Bot nicht erreichbar'
  }

  if (error || !bot) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/bots" className="text-sm text-brand-primary hover:underline mb-4 inline-block">
          &larr; Zurück zur Übersicht
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 mt-2">
          <p className="text-sm font-medium text-red-800">Bot nicht verfügbar</p>
          <p className="text-xs text-red-700 mt-1">{error ?? `Bot "${botId}" wurde nicht gefunden.`}</p>
        </div>
      </div>
    )
  }

  const tierCfg = TIER_CONFIG[bot.tier] ?? { label: bot.tier, description: '', color: 'bg-gray-100 text-gray-600' }
  const exampleInput = EXAMPLE_INPUTS[bot.id] ?? {}
  const companyId = session.companyId ?? 'test-company'

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Back link */}
      <Link href="/bots" className="text-sm text-brand-primary hover:underline inline-block">
        &larr; Zurück zur Übersicht
      </Link>

      {/* Bot header */}
      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.46 1.46a3.375 3.375 0 01-4.78 0L12 15.2l-.76.76a3.375 3.375 0 01-4.78 0L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-text-primary">{bot.name}</h1>
              <p className="text-sm text-brand-text-secondary mt-1">{bot.description}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tierCfg.color}`}>
                  {tierCfg.label}
                </span>
                <span className="text-xs text-brand-text-secondary">v{bot.version}</span>
                {status && (
                  <span className="text-xs text-brand-text-secondary">
                    Queue: {status.queueDepth} Jobs
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Connector info */}
        {(bot.requiredConnectors.length > 0 || (bot.optionalConnectors ?? []).length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-2">Connectoren</p>
            <div className="flex flex-wrap gap-2">
              {bot.requiredConnectors.map((c) => (
                <span key={c} className="inline-flex items-center rounded-md bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                  {c} <span className="ml-1 text-[10px] text-orange-500">(pflicht)</span>
                </span>
              ))}
              {(bot.optionalConnectors ?? []).map((c) => (
                <span key={c} className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {c} <span className="ml-1 text-[10px] text-gray-400">(optional)</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Test Runner */}
      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
        <h2 className="text-base font-semibold text-brand-text-primary mb-1">Bot testen</h2>
        <p className="text-xs text-brand-text-secondary mb-4">
          Synchroner Test-Run — das Ergebnis wird direkt angezeigt. Kein Queue, keine Connectoren nötig.
        </p>
        <BotTestRunner
          botId={bot.id}
          botName={bot.name}
          companyId={companyId}
          exampleInput={exampleInput}
        />
      </div>
    </div>
  )
}
