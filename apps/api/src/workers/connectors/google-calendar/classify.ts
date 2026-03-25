// ---------------------------------------------------------------------------
// Event Type Classification
// ---------------------------------------------------------------------------
// Classifies Google Calendar event summaries into domain-specific event types
// used in the Alpen Energie BI modules (Berater, Setter, Bau & Montage).
// ---------------------------------------------------------------------------

export type CalendarEventType =
  | 'aufmass'
  | 'offertenbesprechung'
  | 'entscheidungstermin'
  | 'montage_dc'
  | 'montage_ac'
  | 'meeting'
  | 'private'
  | 'other'

/**
 * Classify a calendar event by its summary text.
 *
 * Rules are applied in priority order: more specific types (aufmass, montage)
 * are checked before generic ones (meeting). Swiss-German and standard German
 * variants are supported.
 */
export function classifyEvent(summary: string | null | undefined): CalendarEventType {
  if (!summary) return 'other'

  const s = summary.toLowerCase()

  // Aufmass / site survey
  if (s.includes('aufmass') || s.includes('aufmaß')) return 'aufmass'

  // Offer discussion
  if (s.includes('offert') || s.includes('angebot')) return 'offertenbesprechung'

  // Decision / closing appointment
  if (s.includes('entscheid') || s.includes('abschluss')) return 'entscheidungstermin'

  // Installation — distinguish AC (grid connection) from DC (panels)
  if (s.includes('montage') || s.includes('dc ') || s.includes('ac ')) {
    return s.includes('ac') ? 'montage_ac' : 'montage_dc'
  }

  // Internal meetings
  if (s.includes('meeting') || s.includes('besprechung') || s.includes('jour fixe') || s.includes('standup')) {
    return 'meeting'
  }

  // Private / absence
  if (s.includes('privat') || s.includes('urlaub') || s.includes('krank') || s.includes('ferien')) {
    return 'private'
  }

  return 'other'
}
