'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestBankDataChange } from '../../../actions'

interface Props {
  supplierId: string
}

function validateIban(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase()
  if (cleaned.length < 15 || cleaned.length > 34) return false
  if (!/^[A-Z]{2}\d{2}/.test(cleaned)) return false
  return true
}

export function BankDataChangeForm({ supplierId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [bankName, setBankName] = useState('')
  const [reason, setReason] = useState('')
  const [source, setSource] = useState<'internal' | 'supplier_request' | 'invoice_mismatch'>('internal')
  const [isUrgent, setIsUrgent] = useState(false)
  const [urgentJustification, setUrgentJustification] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanedIban = iban.replace(/\s/g, '').toUpperCase()
    if (!validateIban(cleanedIban)) {
      setError('Bitte geben Sie eine gueltige IBAN ein (mind. 15 Zeichen, Format: XX00...).')
      return
    }

    if (!reason.trim()) {
      setError('Bitte geben Sie einen Grund fuer die Aenderung an.')
      return
    }

    setLoading(true)
    const result = await requestBankDataChange(supplierId, {
      proposed_iban: cleanedIban,
      proposed_bic: bic.trim() || undefined,
      proposed_bank_name: bankName.trim() || undefined,
      reason: reason.trim(),
      source,
      is_urgent: isUrgent,
      urgent_justification: isUrgent ? urgentJustification.trim() : undefined,
    })

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Fehler beim Erstellen des Antrags.')
      return
    }

    router.push(`/finanzplanung/lieferanten/${supplierId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Neue IBAN <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="CH93 0076 2011 6238 5295 7"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">BIC / SWIFT</label>
          <input
            type="text"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            placeholder="UBSWCHZH80A"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bankname</label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="UBS Switzerland AG"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Quelle der Aenderung <span className="text-red-500">*</span>
        </label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as typeof source)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="internal">Interne Aenderung</option>
          <option value="supplier_request">Lieferantenanfrage</option>
          <option value="invoice_mismatch">Rechnungsabweichung</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Grund der Aenderung <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="z.B. Lieferant hat per Brief neue Bankverbindung mitgeteilt..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="font-medium text-red-700">Dringend</span>
        </label>
      </div>

      {isUrgent && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Begruendung der Dringlichkeit
          </label>
          <input
            type="text"
            value={urgentJustification}
            onChange={(e) => setUrgentJustification(e.target.value)}
            placeholder="z.B. Zahlung muss bis morgen raus..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
        <strong>Hinweis:</strong> Bankdaten-Aenderungen unterliegen dem 4-Augen-Prinzip.
        Nach Einreichung muss der Antrag von einer anderen Person geprueft und von einer
        dritten Person genehmigt werden.
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Wird eingereicht...' : 'Antrag einreichen'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}
