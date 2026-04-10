/**
 * PII scrubber for call transcripts.
 *
 * Removes personal identifiable information before sending text to the
 * Claude API, as required by the platform's data-residency and PII policy.
 *
 * Targets:
 * - Swiss phone numbers (mobile +41 7x, landline +41 xx, local formats)
 * - Email addresses
 * - Swiss postal codes (4-digit, contextual)
 * - Swiss IBAN numbers (CH format)
 * - Known person names (from team member / customer registries)
 */

export interface ScrubResult {
  /** The transcript with PII replaced by placeholder tokens. */
  scrubbed: string
  /** Map from placeholder token to original value, for optional re-hydration. */
  replacements: Map<string, string>
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * Swiss phone numbers in various formats:
 * +41 79 123 45 67, 0041 79 123 45 67, 079 123 45 67,
 * +41791234567, 079-123-45-67
 */
const SWISS_PHONE_RE =
  /(?:\+41|0041|0)\s?(?:\(0\))?\s?\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}/g

/** Email addresses */
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

/**
 * Swiss IBAN: CH followed by 2 check digits and 17 alphanumeric characters.
 * Allows optional spaces every 4 characters.
 */
const IBAN_CH_RE = /\bCH\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{1}\b/gi

/**
 * Swiss postal codes: 4-digit number preceded by a common keyword
 * (to avoid false positives on random 4-digit numbers in speech).
 */
const POSTAL_CODE_RE =
  /(?:PLZ|Postleitzahl|wohnt?\s+in|aus|Adresse|Strasse)\s+(\d{4})\b/gi

// ---------------------------------------------------------------------------
// Counters for unique placeholders
// ---------------------------------------------------------------------------

interface Counters {
  phone: number
  email: number
  iban: number
  postal: number
  name: number
}

function newCounters(): Counters {
  return { phone: 0, email: 0, iban: 0, postal: 0, name: 0 }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Builds a regex that matches any of the provided names as whole words,
 * case-insensitive. Names shorter than 2 characters are skipped.
 */
function buildNameRegex(names: string[]): RegExp | null {
  const escaped = names
    .filter((n) => n.length >= 2)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (escaped.length === 0) return null

  // \b does not work perfectly with Unicode, but is sufficient for
  // Latin-alphabet names in German transcripts.
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi')
}

/**
 * Scrubs PII from a transcript string.
 *
 * @param text        Raw transcript text.
 * @param knownNames  Optional list of known person names (first + last) to scrub.
 *                    Both individual parts and full names are matched.
 * @returns           ScrubResult with the cleaned text and a replacement map.
 */
export function scrubPII(text: string, knownNames: string[] = []): ScrubResult {
  const replacements = new Map<string, string>()
  const counters = newCounters()
  let result = text

  // --- 1. IBAN (longest patterns first to avoid partial matches) ---
  result = result.replace(IBAN_CH_RE, (match) => {
    counters.iban += 1
    const token = `[IBAN_${counters.iban}]`
    replacements.set(token, match)
    return token
  })

  // --- 2. Phone numbers ---
  result = result.replace(SWISS_PHONE_RE, (match) => {
    counters.phone += 1
    const token = `[PHONE_${counters.phone}]`
    replacements.set(token, match)
    return token
  })

  // --- 3. Email addresses ---
  result = result.replace(EMAIL_RE, (match) => {
    counters.email += 1
    const token = `[EMAIL_${counters.email}]`
    replacements.set(token, match)
    return token
  })

  // --- 4. Postal codes (capture group 1 is the 4-digit code) ---
  result = result.replace(POSTAL_CODE_RE, (fullMatch, code: string) => {
    counters.postal += 1
    const token = `[PLZ_${counters.postal}]`
    replacements.set(token, code)
    return fullMatch.replace(code, token)
  })

  // --- 5. Known person names ---
  if (knownNames.length > 0) {
    // Split "Max Mustermann" into ["Max", "Mustermann", "Max Mustermann"]
    const allTokens = new Set<string>()
    for (const name of knownNames) {
      allTokens.add(name.trim())
      for (const part of name.trim().split(/\s+/)) {
        if (part.length >= 2) {
          allTokens.add(part)
        }
      }
    }

    // Sort by length descending so longer names are matched first
    const sorted = [...allTokens].sort((a, b) => b.length - a.length)
    const nameRe = buildNameRegex(sorted)

    if (nameRe) {
      result = result.replace(nameRe, (match) => {
        counters.name += 1
        const token = `[PERSON_${counters.name}]`
        replacements.set(token, match)
        return token
      })
    }
  }

  return { scrubbed: result, replacements }
}
