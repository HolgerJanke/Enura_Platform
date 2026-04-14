'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestBankDataChange } from '../../../actions'

interface Props {
  supplierId: string
}

// IBAN country code → expected length
const IBAN_LENGTHS: Record<string, number> = {
  CH: 21, DE: 22, AT: 20, FR: 27, IT: 27, ES: 24, NL: 18, BE: 16,
  LU: 20, LI: 21, GB: 22, IE: 22, PT: 25, FI: 18, SE: 24, DK: 18,
  NO: 15, PL: 28, CZ: 24, HU: 28, SK: 24, SI: 19, HR: 21, RO: 24,
  BG: 22, GR: 27, CY: 28, MT: 31, LV: 21, LT: 20, EE: 20,
}

const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Schweiz', DE: 'Deutschland', AT: 'Oesterreich', FR: 'Frankreich',
  IT: 'Italien', ES: 'Spanien', NL: 'Niederlande', BE: 'Belgien',
  LU: 'Luxemburg', LI: 'Liechtenstein', GB: 'Grossbritannien',
}

interface IbanValidationResult {
  valid: boolean
  error?: string
  country?: string
  countryName?: string
  bankCode?: string
  formattedIban?: string
}

function validateIban(input: string): IbanValidationResult {
  const cleaned = input.replace(/\s/g, '').toUpperCase()

  // Basic format check
  if (cleaned.length < 15 || cleaned.length > 34) {
    return { valid: false, error: 'IBAN muss zwischen 15 und 34 Zeichen lang sein.' }
  }

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, error: 'IBAN enthaelt ungueltige Zeichen. Format: Laendercode + 2 Pruefziffern + Kontonummer.' }
  }

  const country = cleaned.slice(0, 2)

  // Check country-specific length
  const expectedLength = IBAN_LENGTHS[country]
  if (expectedLength && cleaned.length !== expectedLength) {
    return {
      valid: false,
      error: `IBAN fuer ${COUNTRY_NAMES[country] ?? country} muss genau ${expectedLength} Zeichen lang sein (aktuell: ${cleaned.length}).`,
      country,
    }
  }

  // ISO 13616 Mod-97 checksum verification
  // Move first 4 chars to end, replace letters with numbers (A=10, B=11, ..., Z=35)
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)
  let numericStr = ''
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') {
      numericStr += ch
    } else {
      numericStr += (ch.charCodeAt(0) - 55).toString()
    }
  }

  // Mod 97 on large number (process in chunks to avoid BigInt)
  let remainder = 0
  for (let i = 0; i < numericStr.length; i++) {
    remainder = (remainder * 10 + Number(numericStr[i])) % 97
  }

  if (remainder !== 1) {
    return { valid: false, error: 'IBAN-Pruefsumme ungueltig. Bitte ueberpruefen Sie die eingegebene IBAN.' }
  }

  // Extract bank code (country-specific)
  let bankCode: string | undefined
  if (country === 'CH' || country === 'LI') bankCode = cleaned.slice(4, 9)
  else if (country === 'DE') bankCode = cleaned.slice(4, 12)
  else if (country === 'AT') bankCode = cleaned.slice(4, 9)

  // Format with spaces every 4 chars
  const formattedIban = cleaned.replace(/(.{4})/g, '$1 ').trim()

  return {
    valid: true,
    country,
    countryName: COUNTRY_NAMES[country],
    bankCode,
    formattedIban,
  }
}

export function BankDataChangeForm({ supplierId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ibanValidation, setIbanValidation] = useState<IbanValidationResult | null>(null)

  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [bankName, setBankName] = useState('')
  const [reason, setReason] = useState('')
  const [source, setSource] = useState<'internal' | 'supplier_request' | 'invoice_mismatch'>('internal')
  const [isUrgent, setIsUrgent] = useState(false)
  const [urgentJustification, setUrgentJustification] = useState('')

  function handleIbanChange(value: string) {
    setIban(value)
    const cleaned = value.replace(/\s/g, '')
    if (cleaned.length >= 5) {
      setIbanValidation(validateIban(cleaned))
    } else {
      setIbanValidation(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanedIban = iban.replace(/\s/g, '').toUpperCase()
    const result = validateIban(cleanedIban)
    setIbanValidation(result)

    if (!result.valid) {
      setError(result.error ?? 'Ungueltige IBAN.')
      return
    }

    if (!reason.trim()) {
      setError('Bitte geben Sie einen Grund fuer die Aenderung an.')
      return
    }

    setLoading(true)
    const submitResult = await requestBankDataChange(supplierId, {
      proposed_iban: cleanedIban,
      proposed_bic: bic.trim() || undefined,
      proposed_bank_name: bankName.trim() || undefined,
      reason: reason.trim(),
      source,
      is_urgent: isUrgent,
      urgent_justification: isUrgent ? urgentJustification.trim() : undefined,
    })

    setLoading(false)

    if (!submitResult.success) {
      setError(submitResult.error ?? 'Fehler beim Erstellen des Antrags.')
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
          onChange={(e) => handleIbanChange(e.target.value)}
          placeholder="CH93 0076 2011 6238 5295 7"
          className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:ring-1 ${
            ibanValidation === null
              ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              : ibanValidation.valid
                ? 'border-green-400 focus:border-green-500 focus:ring-green-500'
                : 'border-red-400 focus:border-red-500 focus:ring-red-500'
          }`}
          required
        />
        {ibanValidation && (
          <div className="mt-1.5">
            {ibanValidation.valid ? (
              <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-2.5">
                <svg className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div className="text-xs text-green-800">
                  <p className="font-medium">IBAN gueltig</p>
                  <p className="text-green-700 mt-0.5">
                    {ibanValidation.countryName && `Land: ${ibanValidation.countryName}`}
                    {ibanValidation.bankCode && ` · Bankcode: ${ibanValidation.bankCode}`}
                  </p>
                  {ibanValidation.formattedIban && (
                    <p className="font-mono mt-0.5">{ibanValidation.formattedIban}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5">
                <svg className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-red-700">{ibanValidation.error}</p>
              </div>
            )}
          </div>
        )}
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
