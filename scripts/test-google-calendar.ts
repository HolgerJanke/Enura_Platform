/**
 * Google Calendar API — Verbindungstest
 *
 * Erfordert ein Service Account JSON-Schlüsseldatei und eine Kalender-ID.
 *
 * Führe aus mit:
 *   GOOGLE_SERVICE_ACCOUNT_PATH=/pfad/zu/key.json GOOGLE_CALENDAR_ID=xxx@group.calendar.google.com npx tsx scripts/test-google-calendar.ts
 *
 * Oder mit dem JSON direkt als String:
 *   GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' GOOGLE_CALENDAR_ID=xxx npx tsx scripts/test-google-calendar.ts
 *
 * Voraussetzungen:
 * 1. Service Account in Google Cloud Console erstellen
 * 2. Google Calendar API aktivieren
 * 3. Service Account E-Mail dem Kalender als "Leser" hinzufügen
 */

import { google } from 'googleapis'
import * as fs from 'fs'

// Accept key from file path or raw JSON string
function loadServiceAccountKey(): Record<string, unknown> {
  const jsonStr = process.env['GOOGLE_SERVICE_ACCOUNT_JSON']
  const jsonPath = process.env['GOOGLE_SERVICE_ACCOUNT_PATH']

  if (jsonStr) {
    try {
      return JSON.parse(jsonStr) as Record<string, unknown>
    } catch {
      console.error('❌  GOOGLE_SERVICE_ACCOUNT_JSON ist kein gültiges JSON.')
      process.exit(1)
    }
  }

  if (jsonPath) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8')
      return JSON.parse(content) as Record<string, unknown>
    } catch {
      console.error(`❌  Datei nicht gefunden oder ungültig: ${jsonPath}`)
      process.exit(1)
    }
  }

  console.error('❌  Bitte setze GOOGLE_SERVICE_ACCOUNT_JSON oder GOOGLE_SERVICE_ACCOUNT_PATH.')
  console.error('   Beispiel: GOOGLE_SERVICE_ACCOUNT_PATH=./key.json GOOGLE_CALENDAR_ID=xxx npx tsx scripts/test-google-calendar.ts')
  process.exit(1)
}

const serviceAccountKey = loadServiceAccountKey()
const CALENDAR_ID = process.env['GOOGLE_CALENDAR_ID'] ?? ''

if (!CALENDAR_ID) {
  console.error('❌  Bitte setze GOOGLE_CALENDAR_ID als Umgebungsvariable.')
  console.error('   Beispiel: GOOGLE_CALENDAR_ID=xxx@group.calendar.google.com')
  process.exit(1)
}

function buildAuth() {
  return new google.auth.JWT({
    email:  serviceAccountKey['client_email'] as string,
    key:    serviceAccountKey['private_key'] as string,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
}

async function testAuthentication() {
  console.log('\n🔑  Service Account Authentication ...')
  const auth = buildAuth()
  await auth.authorize()
  console.log(`   ✅  Authentifizierung erfolgreich`)
  console.log(`   Service Account: ${serviceAccountKey['client_email']}`)
  console.log(`   Projekt: ${serviceAccountKey['project_id']}`)
}

async function testCalendarEvents() {
  const now   = new Date()
  const past  = new Date()
  past.setDate(past.getDate() - 30)

  console.log(`\n📅  GET Calendar Events (letzte 30 Tage) für ${CALENDAR_ID} ...`)

  const auth = buildAuth()
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.events.list({
    calendarId:   CALENDAR_ID,
    timeMin:      past.toISOString(),
    timeMax:      now.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    maxResults:   5,
  })

  const items = res.data.items ?? []
  console.log(`   ✅  ${items.length} Event(s) in den letzten 30 Tagen`)

  if (items.length > 0) {
    const e = items[0]
    console.log(`   Beispiel: "${e.summary}" — ${e.start?.dateTime ?? e.start?.date}`)
    console.log(`   Felder: ${JSON.stringify(Object.keys(e))}`)
  }

  return items
}

async function testCalendarInfo() {
  console.log(`\n📆  GET Calendar Info (${CALENDAR_ID}) ...`)

  const auth = buildAuth()
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.calendars.get({ calendarId: CALENDAR_ID })
  const cal = res.data
  console.log(`   ✅  Kalender: "${cal.summary}"`)
  console.log(`   Zeitzone: ${cal.timeZone}`)
  console.log(`   Beschreibung: ${cal.description ?? '(keine)'}`)

  return cal
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Google Calendar API — Verbindungstest')
  console.log(`  Service Account: ${serviceAccountKey['client_email'] ?? '?'}`)
  console.log(`  Kalender-ID:     ${CALENDAR_ID}`)
  console.log('═══════════════════════════════════════════════════')

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const [name, fn] of [
    ['Authentication',   testAuthentication],
    ['Kalender-Info',    testCalendarInfo],
    ['Kalender-Events',  testCalendarEvents],
  ] as const) {
    try {
      await fn()
      results.push({ name, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`   ❌  Fehler: ${msg.split('\n')[0]}`)
      results.push({ name, ok: false, error: msg.split('\n')[0] })
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  Zusammenfassung')
  console.log('═══════════════════════════════════════════════════')
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'}  ${r.name}${r.error ? ` — ${r.error}` : ''}`)
  }

  const hasAuthError = results.find(r => r.name === 'Authentication' && !r.ok)
  if (hasAuthError) {
    console.log('')
    console.log('  Tipps bei Authentication-Fehler:')
    console.log('  1. Google Calendar API in der Cloud Console aktiviert?')
    console.log('  2. Service Account E-Mail dem Kalender hinzugefügt (Freigabe → Leser)?')
    console.log('  3. Ist der private_key vollständig (inkl. -----BEGIN/END PRIVATE KEY-----)?')
  }
  console.log('')
}

main().catch(err => {
  console.error('\n💥  Unerwarteter Fehler:', err)
  process.exit(1)
})
