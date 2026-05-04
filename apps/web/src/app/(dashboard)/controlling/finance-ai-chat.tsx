'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface FinanceContext {
  pipeline_value: number
  offers_won: number
  offers_sent: number
  offers_draft: number
  offers_lost: number
  open_receivables: number
  overdue_amount: number
  overdue_count: number
  open_invoices_count: number
  total_invoices: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  'Wie steht es um unsere Pipeline?',
  'Welche Risiken bestehen aktuell?',
  'Fasse die Finanzsituation zusammen',
  'Was sollten wir als nächstes tun?',
]

function generateResponse(question: string, ctx: FinanceContext): string {
  const q = question.toLowerCase()

  const fmtCHF = (n: number) =>
    `CHF ${Math.round(n).toLocaleString('de-CH')}`

  const totalOffers = ctx.offers_won + ctx.offers_sent + ctx.offers_draft + ctx.offers_lost
  const winRate = ctx.offers_won + ctx.offers_lost > 0
    ? Math.round((ctx.offers_won / (ctx.offers_won + ctx.offers_lost)) * 100)
    : 0

  // Pipeline question
  if (q.includes('pipeline') || q.includes('angebot') || q.includes('vertrieb')) {
    const lines = [
      `**Pipeline-Analyse:**\n`,
      `Der aktuelle Pipeline-Wert beträgt **${fmtCHF(ctx.pipeline_value)}** mit insgesamt **${totalOffers} Angeboten**.`,
      ``,
      `- **${ctx.offers_draft}** Entwürfe warten auf Versand`,
      `- **${ctx.offers_sent}** Angebote sind versendet und offen`,
      `- **${ctx.offers_won}** wurden gewonnen (Abschlussquote: ${winRate}%)`,
      `- **${ctx.offers_lost}** wurden verloren`,
    ]
    if (ctx.offers_draft > 5) {
      lines.push(``, `⚠️ **Empfehlung:** ${ctx.offers_draft} Entwürfe stehen noch aus. Prüfen Sie, ob diese zeitnah versendet werden können.`)
    }
    if (winRate < 30 && totalOffers > 10) {
      lines.push(``, `⚠️ **Hinweis:** Die Abschlussquote von ${winRate}% liegt unter dem Branchendurchschnitt. Eine Analyse der Verlustgründe könnte hilfreich sein.`)
    }
    return lines.join('\n')
  }

  // Risk question
  if (q.includes('risik') || q.includes('warnung') || q.includes('problem') || q.includes('gefahr')) {
    const risks: string[] = []
    if (ctx.overdue_count > 0) {
      risks.push(`🔴 **Überfällige Rechnungen:** ${ctx.overdue_count} Rechnungen mit einem Volumen von ${fmtCHF(ctx.overdue_amount)} sind überfällig. Mahnprozess prüfen.`)
    }
    if (ctx.open_receivables > ctx.pipeline_value * 0.5) {
      risks.push(`🟡 **Hohe offene Forderungen:** ${fmtCHF(ctx.open_receivables)} offene Forderungen stehen ${fmtCHF(ctx.pipeline_value)} Pipeline-Wert gegenüber.`)
    }
    if (ctx.offers_lost > ctx.offers_won && totalOffers > 5) {
      risks.push(`🟡 **Niedrige Abschlussrate:** Mehr Angebote verloren (${ctx.offers_lost}) als gewonnen (${ctx.offers_won}).`)
    }
    if (ctx.offers_draft > ctx.offers_sent) {
      risks.push(`🟡 **Angebotsstau:** Mehr Entwürfe (${ctx.offers_draft}) als versendete Angebote (${ctx.offers_sent}). Pipeline könnte ins Stocken geraten.`)
    }
    if (risks.length === 0) {
      return `**Risikoanalyse:**\n\n✅ Keine kritischen Risiken identifiziert. Die Kennzahlen liegen im normalen Bereich.`
    }
    return `**Risikoanalyse:**\n\n${risks.join('\n\n')}`
  }

  // Summary / Zusammenfassung
  if (q.includes('zusammen') || q.includes('überblick') || q.includes('fasse') || q.includes('status') || q.includes('situation')) {
    return [
      `**Finanzübersicht:**\n`,
      `📊 **Pipeline:** ${fmtCHF(ctx.pipeline_value)} in ${totalOffers} Angeboten`,
      `✅ **Abschlüsse:** ${ctx.offers_won} gewonnen (${winRate}% Rate)`,
      `📬 **Offene Angebote:** ${ctx.offers_sent} versendet, ${ctx.offers_draft} Entwürfe`,
      `💰 **Offene Forderungen:** ${fmtCHF(ctx.open_receivables)} (${ctx.open_invoices_count} Rechnungen)`,
      ctx.overdue_count > 0
        ? `⚠️ **Überfällig:** ${fmtCHF(ctx.overdue_amount)} (${ctx.overdue_count} Rechnungen)`
        : `✅ **Keine überfälligen Rechnungen**`,
    ].join('\n')
  }

  // Recommendation / Empfehlung
  if (q.includes('empfehl') || q.includes('nächst') || q.includes('tun') || q.includes('aktion') || q.includes('todo')) {
    const actions: string[] = [`**Empfohlene nächste Schritte:**\n`]
    let priority = 1
    if (ctx.overdue_count > 0) {
      actions.push(`${priority}. **Mahnwesen aktivieren:** ${ctx.overdue_count} überfällige Rechnungen (${fmtCHF(ctx.overdue_amount)}) zeitnah nachverfolgen.`)
      priority++
    }
    if (ctx.offers_draft > 3) {
      actions.push(`${priority}. **Entwürfe versenden:** ${ctx.offers_draft} Angebote stehen als Entwurf und sollten zeitnah versendet werden.`)
      priority++
    }
    if (ctx.offers_sent > 5) {
      actions.push(`${priority}. **Follow-up planen:** ${ctx.offers_sent} versendete Angebote nachfassen, um die Abschlussquote zu erhöhen.`)
      priority++
    }
    if (winRate < 40 && totalOffers > 10) {
      actions.push(`${priority}. **Angebotsqualität prüfen:** Bei einer Abschlussrate von ${winRate}% sollten die Angebotsstrategien überprüft werden.`)
      priority++
    }
    if (priority === 1) {
      actions.push(`✅ Aktuell keine dringenden Aktionspunkte. Weiterhin regelmässig die Pipeline und Forderungen überwachen.`)
    }
    return actions.join('\n')
  }

  // Default response
  return [
    `Basierend auf Ihren aktuellen Finanzdaten:\n`,
    `- **Pipeline-Wert:** ${fmtCHF(ctx.pipeline_value)}`,
    `- **Abschlüsse:** ${ctx.offers_won} von ${totalOffers} (${winRate}%)`,
    `- **Offene Forderungen:** ${fmtCHF(ctx.open_receivables)}`,
    ctx.overdue_count > 0 ? `- **Überfällig:** ${fmtCHF(ctx.overdue_amount)}` : '',
    `\nStellen Sie mir eine spezifischere Frage, z.B. zu Pipeline, Risiken oder Empfehlungen.`,
  ].filter(Boolean).join('\n')
}

export function FinanceAIChat({ context }: { context: FinanceContext }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isThinking) return
      const userMsg: Message = { role: 'user', content: text.trim() }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsThinking(true)

      // Simulate AI thinking delay
      setTimeout(() => {
        const response = generateResponse(text, context)
        setMessages((prev) => [...prev, { role: 'assistant', content: response }])
        setIsThinking(false)
      }, 600 + Math.random() * 800)
    },
    [context, isThinking],
  )

  return (
    <div className="flex flex-col h-[420px]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">
              Fragen Sie den KI-Assistenten zu Ihren Finanzdaten
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-50 text-gray-800 border border-gray-100'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content.split('\n').map((line, li) => {
                    // Simple markdown bold rendering
                    const parts = line.split(/(\*\*.*?\*\*)/)
                    return (
                      <span key={li}>
                        {parts.map((part, pi) =>
                          part.startsWith('**') && part.endsWith('**') ? (
                            <strong key={pi}>{part.slice(2, -2)}</strong>
                          ) : (
                            <span key={pi}>{part}</span>
                          ),
                        )}
                        {li < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    )
                  })}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 px-6 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage(input)
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage stellen..."
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/20"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
