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
      {
        id: 'mail-002',
        from: 'bewerbung@example.com',
        to: ['hr@firma.ch'],
        subject: 'Bewerbung als Projektleiter',
        body: 'Sehr geehrte Damen und Herren, hiermit bewerbe ich mich auf die ausgeschriebene Stelle als Projektleiter.',
      },
    ],
    routingRules: { support: 'support@firma.ch', hr: 'hr@firma.ch', sales: 'sales@firma.ch' },
  },
  'document-extract': {
    documents: [
      {
        filename: 'rechnung-2024-042.txt',
        contentType: 'text/plain',
        content: 'Rechnung Nr. RE-2024-042\nFirma Müller AG\nBernstrasse 15\n3001 Bern\nDatum: 15.03.2024\nBetrag: CHF 3450.00 inkl. 8.1% MwSt.\nZahlbar innert 30 Tagen\nBank: PostFinance\nIBAN: CH93 0076 2011 6238 5295 7',
      },
    ],
    forceType: 'invoice',
  },
  'customer-support': {
    queries: [
      {
        id: 'q-001',
        question: 'Wie kann ich mein Passwort zurücksetzen?',
        language: 'de',
      },
    ],
    knowledgeBase: [
      { id: 'kb-1', content: 'Klicken Sie auf "Passwort vergessen" auf der Login-Seite. Sie erhalten eine E-Mail mit einem Reset-Link. Der Link ist 24 Stunden gültig.', source: 'FAQ' },
      { id: 'kb-2', content: 'Nach 5 fehlgeschlagenen Versuchen wird Ihr Account für 15 Minuten gesperrt. Kontaktieren Sie den Support unter support@firma.ch.', source: 'FAQ' },
    ],
    maxSourcesPerQuery: 3,
  },
  'onboarding': {
    entityType: 'customer',
    rawData: {
      firma: 'Müller AG',
      strasse: 'Bernstrasse 15',
      plz: '3001',
      ort: 'Bern',
      ansprechpartner: 'Hans Müller',
      email: 'h.mueller@mueller-ag.ch',
      telefon: '+41 31 123 45 67',
      branche: 'Maschinenbau',
    },
    sourceFormat: 'legacy-crm-export',
    targetSystems: ['crm', 'accounting'],
  },
  'follow-up': {
    targets: [
      {
        id: 'target-001',
        recipientEmail: 'h.mueller@mueller-ag.ch',
        recipientName: 'Hans Müller',
        subject: 'Offene Rechnung RE-2024-042',
        context: { invoiceAmount: 'CHF 3450.00', dueDate: '2024-04-15', daysPastDue: '14' },
        createdAt: '2024-04-01T00:00:00Z',
        lastContactAt: '2024-04-15T00:00:00Z',
        remindersSent: 0,
        status: 'active',
      },
    ],
    rules: [
      {
        id: 'rule-1',
        name: 'Erste Mahnung',
        triggerAfterDays: 14,
        escalationLevel: 1,
        template: 'Sehr geehrte/r {recipientName}, wir erlauben uns, Sie an die offene Rechnung {subject} zu erinnern.',
        channel: 'email',
        maxReminders: 3,
      },
    ],
    dryRun: true,
  },
  'data-sync': {
    sourceSystem: 'CRM',
    targetSystem: 'Buchhaltung',
    direction: 'source_to_target',
    conflictStrategy: 'source_wins',
    mappings: [
      { sourceField: 'name', targetField: 'firmenname', transform: 'uppercase' },
      { sourceField: 'email', targetField: 'kontakt_email', transform: 'lowercase' },
      { sourceField: 'phone', targetField: 'telefon', transform: null },
    ],
    sourceRecords: [
      { id: 'rec-001', fields: { name: 'Müller Solar GmbH', email: 'Info@Mueller-Solar.ch', phone: '+41 44 123 45 67' } },
      { id: 'rec-002', fields: { name: 'Dach & Strom AG', email: 'Kontakt@DachStrom.ch', phone: '+41 61 987 65 43' } },
      { id: 'rec-003', fields: { name: 'Alpine Energy', email: 'hello@alpine-energy.ch', phone: '+41 31 555 12 34' } },
    ],
    targetRecords: [
      { id: 'rec-001', fields: { firmenname: 'Mueller Solar GmbH', kontakt_email: 'info@mueller-solar.ch', telefon: '+41 44 123 45 67' } },
    ],
    dryRun: true,
  },
  'report-generator': {
    title: 'Monatsbericht Mai 2024',
    period: 'monthly',
    sections: [
      {
        title: 'Umsatzentwicklung',
        type: 'kpi',
        data: [
          { label: 'Umsatz', value: 125000, unit: 'CHF', change: 12.5 },
          { label: 'Neukunden', value: 8, change: -5 },
          { label: 'Abschlussquote', value: 34, unit: '%', change: 2.1 },
        ],
        aiSummary: true,
      },
      {
        title: 'Top-Projekte',
        type: 'table',
        data: [
          { projekt: 'Müller AG', umsatz: 45000, status: 'Abgeschlossen' },
          { projekt: 'Weber GmbH', umsatz: 32000, status: 'Laufend' },
        ],
        aiSummary: false,
      },
    ],
    format: 'markdown',
    language: 'de',
    includeExecutiveSummary: true,
  },
  'appointment': {
    action: 'find_slot',
    customerRequest: 'Ich brauche einen Termin nächste Woche Dienstag oder Mittwoch, am besten vormittags.',
    availableSlots: [
      { date: '2024-05-14', startTime: '09:00', endTime: '10:00', booked: false },
      { date: '2024-05-14', startTime: '10:00', endTime: '11:00', booked: true, label: 'Meeting intern' },
      { date: '2024-05-14', startTime: '14:00', endTime: '15:00', booked: false },
      { date: '2024-05-15', startTime: '09:00', endTime: '10:00', booked: false },
      { date: '2024-05-15', startTime: '11:00', endTime: '12:00', booked: false },
    ],
    language: 'de',
  },
  'employee-mgmt': {
    requestText: 'Lukas Weber möchte vom 10. Juni bis 21. Juni 2024 Urlaub nehmen. Sommerferien mit Familie.',
    employeeId: 'emp-042',
    employeeName: 'Lukas Weber',
    department: 'Technik',
    language: 'de',
  },
  'inventory': {
    items: [
      { id: 'item-001', name: 'Wechselrichter SMA 10kW', currentStock: 3, reorderThreshold: 5, unit: 'Stk', unitPrice: 1850, category: 'Wechselrichter' },
      { id: 'item-002', name: 'Kabel 6mm² (100m)', currentStock: 12, reorderThreshold: 10, unit: 'Rolle', avgDailyConsumption: 0.8, unitPrice: 95, category: 'Kabel' },
      { id: 'item-003', name: 'Sicherungsautomat 32A', currentStock: 0, reorderThreshold: 8, unit: 'Stk', unitPrice: 24.50, category: 'Elektro' },
      { id: 'item-004', name: 'Dichtmasse (Kartusche)', currentStock: 25, reorderThreshold: 5, unit: 'Stk', expiryDate: '2024-06-15', unitPrice: 12, category: 'Verbrauch' },
    ],
    checkDate: '2024-05-12',
    expiryWarningDays: 30,
    slowMovingDays: 60,
  },
  'billing': {
    action: 'generate_invoice',
    timeEntries: [
      { date: '2024-05-01', hours: 4, description: 'Beratung und Setup', project: 'Müller AG', rate: 150 },
      { date: '2024-05-02', hours: 6, description: 'Implementation Phase 1', project: 'Müller AG', rate: 150 },
      { date: '2024-05-05', hours: 3, description: 'Testing und Abnahme', project: 'Müller AG', rate: 150 },
    ],
    customerName: 'Müller AG',
    customerAddress: 'Bernstrasse 15, 3001 Bern',
    defaultRate: 150,
    vatRate: 8.1,
    currency: 'CHF',
    paymentTerms: '30 Tage netto',
  },
  'tax-prep': {
    expenses: [
      { id: 'r-001', date: '2024-05-01', description: 'Büromaterial Papeterie', amount: 85.50, vendor: 'Papeterie AG', paymentMethod: 'Kreditkarte' },
      { id: 'r-002', date: '2024-05-03', description: 'Software-Lizenz Adobe Creative Cloud', amount: 345.00, vendor: 'Adobe Inc.', paymentMethod: 'Kreditkarte' },
      { id: 'r-003', date: '2024-05-05', description: 'Geschäftsessen mit Kunde Weber', amount: 22.80, vendor: 'Restaurant Löwen', paymentMethod: 'Bar' },
      { id: 'r-004', date: '2024-05-08', description: 'Zugticket Bern-Zürich retour', amount: 102.00, vendor: 'SBB', paymentMethod: 'Halbtax' },
    ],
    period: '2024-Q2',
    existingCategories: ['Büromaterial', 'Software', 'Reisekosten', 'Bewirtung', 'Miete', 'Versicherung'],
    language: 'de',
  },
  'review-analysis': {
    reviews: [
      { id: 'rev-001', text: 'Sehr guter Service, schnelle Lieferung. Bin zufrieden!', rating: 5, source: 'google', date: '2024-05-01' },
      { id: 'rev-002', text: 'Produkt okay, aber die Kommunikation war schlecht. Musste 3x nachfragen wegen Liefertermin.', rating: 2, source: 'google', date: '2024-05-03' },
      { id: 'rev-003', text: 'Top Beratung, faire Preise. Komme wieder!', rating: 4, source: 'google', date: '2024-05-05' },
      { id: 'rev-004', text: 'Montage war unsauber, Kabel nicht richtig verlegt. Nachbesserung war aber schnell und kostenlos.', rating: 3, source: 'google', date: '2024-05-08' },
    ],
    language: 'de',
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
