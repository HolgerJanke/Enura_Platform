/**
 * Post-processing normaliser for Swiss German (Schweizerdeutsch) transcripts.
 *
 * Whisper often produces dialect spellings or inconsistent casing for
 * domain-specific terms. This module applies two correction passes:
 *
 * 1. Common Swiss German dialect words are normalised to Hochdeutsch.
 * 2. PV industry terms are capitalised consistently.
 */

// ---------------------------------------------------------------------------
// Swiss German -> Hochdeutsch replacements
// ---------------------------------------------------------------------------

/**
 * Map of common Schweizerdeutsch words/phrases to their Hochdeutsch equivalents.
 * Keys are lowercase for case-insensitive matching.
 */
const DIALECT_MAP: ReadonlyMap<string, string> = new Map([
  // Negation / modal verbs
  ['nöd', 'nicht'],
  ['nöt', 'nicht'],
  ['ned', 'nicht'],
  ['nid', 'nicht'],
  ['chönn', 'können'],
  ['chönne', 'können'],
  ['chönnt', 'könnt'],
  ['chönnted', 'könnten'],
  ['söll', 'soll'],
  ['sötti', 'sollte'],
  ['wött', 'will'],
  ['wötted', 'wollten'],
  ['müesst', 'müsst'],
  ['müesse', 'müssen'],
  ['dörf', 'darf'],
  ['dörfe', 'dürfen'],

  // Common verbs
  ['luege', 'schauen'],
  ['lueg', 'schau'],
  ['gseh', 'gesehen'],
  ['gsi', 'gewesen'],
  ['gha', 'gehabt'],
  ['gmacht', 'gemacht'],
  ['gseit', 'gesagt'],
  ['gfrage', 'gefragt'],
  ['gschickt', 'geschickt'],
  ['gredt', 'geredet'],
  ['aagluegt', 'angeschaut'],
  ['aaglueget', 'angeschaut'],
  ['aaluege', 'anschauen'],
  ['aaruefe', 'anrufen'],
  ['aagfange', 'angefangen'],
  ['uufghört', 'aufgehört'],

  // Pronouns / articles
  ['ich', 'ich'],
  ['mir', 'wir'],
  ['üs', 'uns'],
  ['eu', 'euch'],
  ['si', 'sie'],
  ['de', 'der'],
  ['es', 'es'],

  // Prepositions / adverbs
  ['druf', 'darauf'],
  ['dra', 'daran'],
  ['drmit', 'damit'],
  ['dehei', 'zuhause'],
  ['etz', 'jetzt'],
  ['jetz', 'jetzt'],
  ['hüt', 'heute'],
  ['morn', 'morgen'],
  ['gester', 'gestern'],
  ['geschter', 'gestern'],
  ['scho', 'schon'],
  ['ou', 'auch'],
  ['au', 'auch'],
  ['no', 'noch'],
  ['halt', 'halt'],

  // Nouns / misc
  ['chind', 'Kind'],
  ['huus', 'Haus'],
  ['daach', 'Dach'],
  ['züri', 'Zürich'],
  ['bärn', 'Bern'],
  ['grüezi', 'Grüezi'],
  ['merci', 'danke'],
  ['ade', 'auf Wiedersehen'],
  ['tschüss', 'Tschüss'],
  ['tschau', 'Tschüss'],

  // Business
  ['offerte', 'Offerte'],
  ['termin', 'Termin'],
  ['abot', 'Angebot'],
])

// ---------------------------------------------------------------------------
// PV industry term capitalisation
// ---------------------------------------------------------------------------

/**
 * Terms that should always be capitalised in a specific way.
 * Keys are lowercase for matching; values are the correct form.
 */
const INDUSTRY_TERMS: ReadonlyMap<string, string> = new Map([
  ['photovoltaik', 'Photovoltaik'],
  ['pv-anlage', 'PV-Anlage'],
  ['pv anlage', 'PV-Anlage'],
  ['solaranlage', 'Solaranlage'],
  ['solarpanel', 'Solarpanel'],
  ['solarpanels', 'Solarpanels'],
  ['wärmepumpe', 'Wärmepumpe'],
  ['wärmepumpen', 'Wärmepumpen'],
  ['wechselrichter', 'Wechselrichter'],
  ['eigenverbrauch', 'Eigenverbrauch'],
  ['einspeisung', 'Einspeisung'],
  ['einspeisevergütung', 'Einspeisevergütung'],
  ['kilowatt-peak', 'Kilowatt-Peak'],
  ['kwp', 'kWp'],
  ['kwh', 'kWh'],
  ['stromspeicher', 'Stromspeicher'],
  ['batteriespeicher', 'Batteriespeicher'],
  ['aufdach', 'Aufdach'],
  ['indach', 'Indach'],
  ['flachdach', 'Flachdach'],
  ['schrägdach', 'Schrägdach'],
  ['montage', 'Montage'],
  ['installateur', 'Installateur'],
  ['elektroinstallation', 'Elektroinstallation'],
  ['netzanschluss', 'Netzanschluss'],
  ['zählerschrank', 'Zählerschrank'],
  ['förderung', 'Förderung'],
  ['pronovo', 'Pronovo'],
  ['einmalvergütung', 'Einmalvergütung'],
  ['energieberatung', 'Energieberatung'],
  ['energieausweis', 'Energieausweis'],
  ['nachhaltigkeit', 'Nachhaltigkeit'],
])

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Builds a word-boundary regex for a given term (case-insensitive).
 */
function wordBoundaryRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'gi')
}

/**
 * Normalises a Swiss German transcript to Hochdeutsch and applies
 * consistent capitalisation for PV industry terminology.
 *
 * @param transcript  Raw transcript from Whisper.
 * @returns           Cleaned transcript string.
 */
export function normaliseSwissGerman(transcript: string): string {
  let result = transcript

  // Pass 1: Replace dialect words with Hochdeutsch equivalents
  for (const [dialect, hochdeutsch] of DIALECT_MAP) {
    const re = wordBoundaryRegex(dialect)
    result = result.replace(re, (match) => {
      // Preserve original capitalisation of first character if the replacement starts lowercase
      const firstChar = match[0] ?? ''
      const hdFirst = hochdeutsch[0] ?? ''
      if (firstChar === firstChar.toUpperCase() && hdFirst === hdFirst.toLowerCase()) {
        return hdFirst.toUpperCase() + hochdeutsch.slice(1)
      }
      return hochdeutsch
    })
  }

  // Pass 2: Correct industry term capitalisation
  for (const [lowered, correct] of INDUSTRY_TERMS) {
    const re = wordBoundaryRegex(lowered)
    result = result.replace(re, correct)
  }

  // Pass 3: Clean up common Whisper artefacts
  // Remove repeated spaces
  result = result.replace(/ {2,}/g, ' ')

  // Fix spacing before punctuation
  result = result.replace(/ ([.,!?;:])/g, '$1')

  return result.trim()
}
