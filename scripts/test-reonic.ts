/**
 * Reonic API v2 — Verbindungstest
 *
 * Führe aus mit:
 *   REONIC_API_KEY=xxx REONIC_CLIENT_ID=yyy npx tsx scripts/test-reonic.ts
 *
 * Oder lege zuerst eine .env.test Datei an:
 *   REONIC_API_KEY=dein-key
 *   REONIC_CLIENT_ID=deine-uuid
 */

const API_KEY   = process.env['REONIC_API_KEY']   ?? ''
const CLIENT_ID = process.env['REONIC_CLIENT_ID'] ?? ''
const BASE_URL  = 'https://api.reonic.de/rest/v2'

if (!API_KEY || !CLIENT_ID) {
  console.error('❌  Bitte setze REONIC_API_KEY und REONIC_CLIENT_ID als Umgebungsvariablen.')
  console.error('   Beispiel: REONIC_API_KEY=xxx REONIC_CLIENT_ID=yyy npx tsx scripts/test-reonic.ts')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Einfacher HTTP-Helfer (kein externes Package nötig)
// ---------------------------------------------------------------------------
async function get(path: string, query: Record<string, string> = {}): Promise<unknown> {
  // NOTE: Do NOT use new URL(path, BASE_URL) — when path starts with '/',
  // the URL spec drops the base path (/rest/v2) and replaces it with the
  // absolute path. String concat is safe here since BASE_URL has no trailing slash.
  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'x-authorization': API_KEY,
      'Content-Type': 'application/json',
    },
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`)
  }

  return JSON.parse(text)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
async function testUsers() {
  console.log('\n📋  GET /clients/{clientId}/users ...')
  const data = await get(`/clients/${CLIENT_ID}/users`)
  const arr = Array.isArray(data)
    ? data
    : ((data as { content?: unknown[] }).content ?? [])
  console.log(`   ✅  ${arr.length} User(s) zurückgekommen`)
  if (arr.length > 0) {
    const first = arr[0] as Record<string, unknown>
    // Try both camelCase (v2) and snake_case (legacy)
    const fn = first['firstName'] ?? first['first_name'] ?? '?'
    const ln = first['lastName']  ?? first['last_name']  ?? '?'
    console.log(`   Felder (Schlüssel): ${JSON.stringify(Object.keys(first))}`)
    console.log(`   Beispiel: ${fn} ${ln} <${first['email'] ?? '?'}>`)
  }
  return arr
}

async function testContacts() {
  console.log('\n👤  GET /clients/{clientId}/contacts?page=0&size=5 ...')
  const data = await get(`/clients/${CLIENT_ID}/contacts`, { page: '0', size: '5' })
  const arr = Array.isArray(data)
    ? data
    : ((data as { content?: unknown[] }).content ?? [])
  const total = Array.isArray(data)
    ? arr.length
    : ((data as { totalElements?: number }).totalElements ?? arr.length)
  console.log(`   ✅  ${arr.length} Kontakt(e) auf Seite 1 (total: ${total})`)
  if (arr.length > 0) {
    const c = arr[0] as Record<string, unknown>
    console.log(`   Felder (Schlüssel): ${JSON.stringify(Object.keys(c))}`)
    console.log(`   Beispiel-Objekt:    ${JSON.stringify(c, null, 2).slice(0, 500)}`)
  }
  return arr
}

async function testOffers() {
  console.log('\n📄  GET /clients/{clientId}/h360/offers?page=0&size=5 ...')
  const data = await get(`/clients/${CLIENT_ID}/h360/offers`, { page: '0', size: '5' })
  // h360/offers returns { results: [...] } — different from contacts
  const arr = Array.isArray(data)
    ? data
    : ((data as { results?: unknown[]; content?: unknown[] }).results
        ?? (data as { content?: unknown[] }).content
        ?? [])
  const total = Array.isArray(data)
    ? arr.length
    : ((data as { totalElements?: number; total?: number }).totalElements
        ?? (data as { total?: number }).total
        ?? arr.length)
  console.log(`   ✅  ${arr.length} Angebot(e) auf Seite 1 (total: ${total})`)
  if (arr.length > 0) {
    const o = arr[0] as Record<string, unknown>
    console.log(`   Felder Beispiel: ${JSON.stringify(Object.keys(o))}`)
    console.log(`   Beispiel-Objekt: ${JSON.stringify(o, null, 2).slice(0, 400)}`)
  }
  return arr
}

async function testActivityStatus() {
  const now   = new Date()
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // letzte 7 Tage
  const from  = since.toISOString()
  const to    = now.toISOString()
  console.log(`\n⚡  GET /clients/{clientId}/activities/status?from=${from.slice(0, 10)}&to=${to.slice(0, 10)} ...`)
  const data = await get(`/clients/${CLIENT_ID}/activities/status`, { from, to })
  const arr = Array.isArray(data) ? data : (data as { content: unknown[] }).content ?? []
  console.log(`   ✅  ${arr.length} Aktivitäts-Event(s) in den letzten 7 Tagen`)
  return arr
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------
async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Reonic REST API v2 — Verbindungstest')
  console.log(`  Base URL:  ${BASE_URL}`)
  console.log(`  Client-ID: ${CLIENT_ID}`)
  console.log(`  API Key:   ${API_KEY.slice(0, 4)}${'*'.repeat(Math.max(0, API_KEY.length - 4))}`)
  console.log('═══════════════════════════════════════════════════')

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const [name, fn] of [
    ['Users',            testUsers],
    ['Contacts (Leads)', testContacts],
    ['h360 Offers',      testOffers],
    ['Activity Status',  testActivityStatus],
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
    const icon = r.ok ? '✅' : '❌'
    console.log(`  ${icon}  ${r.name}${r.error ? ` — ${r.error}` : ''}`)
  }

  const allOk = results.every(r => r.ok)
  console.log('')
  if (allOk) {
    console.log('  🎉  Alle Endpunkte erreichbar — Connector kann jetzt konfiguriert werden.')
  } else {
    console.log('  ⚠️   Einige Endpunkte fehlgeschlagen — Credentials oder Endpunktpfade prüfen.')
  }
  console.log('')
}

main().catch(err => {
  console.error('\n💥  Unerwarteter Fehler:', err)
  process.exit(1)
})
