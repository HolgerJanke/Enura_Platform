/**
 * Bexio REST API v2 — Verbindungstest
 *
 * Bexio verwendet OAuth 2.0. Du brauchst ein gültiges Access Token.
 * Entweder über den OAuth-Flow oder direkt im Bexio Developer-Portal.
 *
 * Führe aus mit:
 *   BEXIO_ACCESS_TOKEN=xxx npx tsx scripts/test-bexio.ts
 *
 * Hinweis: Bexio Access Tokens sind kurzlebig (1 Stunde).
 * Im Produktivbetrieb erneuert der Connector das Token automatisch
 * über den Refresh-Token-Flow.
 */

const ACCESS_TOKEN = process.env['BEXIO_ACCESS_TOKEN'] ?? ''
const BASE_URL     = 'https://api.bexio.com/2.0'

if (!ACCESS_TOKEN) {
  console.error('❌  Bitte setze BEXIO_ACCESS_TOKEN als Umgebungsvariable.')
  console.error('   Beispiel: BEXIO_ACCESS_TOKEN=xxx npx tsx scripts/test-bexio.ts')
  console.error('')
  console.error('   Access Token erhältlich:')
  console.error('   1. Bexio Developer Portal → Apps → Deine App → "Access Token generieren"')
  console.error('   2. Oder über den OAuth 2.0 Authorization Code Flow')
  process.exit(1)
}

async function get(path: string, query: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      Accept: 'application/json',
    },
  })

  const text = await res.text()
  if (res.status === 401 || res.status === 403) {
    throw new Error(`HTTP ${res.status} — Token ungültig oder abgelaufen. Erneuere den Access Token.`)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`)
  return JSON.parse(text)
}

async function testInvoices() {
  console.log('\n📄  GET /kb_invoice?offset=0&limit=5 (Rechnungen) ...')
  const data = await get('/kb_invoice', {
    offset: '0',
    limit: '5',
    order_by: 'updated_at',
    order: 'DESC',
  })

  const arr = Array.isArray(data) ? data : []
  console.log(`   ✅  ${arr.length} Rechnung(en) zurückgekommen`)
  if (arr.length > 0) {
    const inv = arr[0] as Record<string, unknown>
    console.log(`   Felder: ${JSON.stringify(Object.keys(inv))}`)
    console.log(`   Beispiel: ${JSON.stringify({
      id: inv['id'],
      document_nr: inv['document_nr'],
      status_id: inv['status_id'],
      total_gross: inv['total_gross'],
      updated_at: inv['updated_at'],
    }, null, 2)}`)
  }
  return arr
}

async function testContacts() {
  console.log('\n👤  GET /contact?offset=0&limit=5 (Kontakte) ...')
  const data = await get('/contact', {
    offset: '0',
    limit: '5',
  })

  const arr = Array.isArray(data) ? data : []
  console.log(`   ✅  ${arr.length} Kontakt(e) zurückgekommen`)
  if (arr.length > 0) {
    const c = arr[0] as Record<string, unknown>
    console.log(`   Felder: ${JSON.stringify(Object.keys(c))}`)
  }
  return arr
}

async function testCompanyProfile() {
  console.log('\n🏢  GET /company_profile (Firmenprofil) ...')
  const data = await get('/company_profile')
  const profile = data as Record<string, unknown>
  console.log(`   ✅  Firma: ${profile['name']} (ID: ${profile['id']})`)
  console.log(`   Land: ${profile['country_name']}, Währung: ${profile['currency_id']}`)
  return data
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Bexio REST API v2 — Verbindungstest')
  console.log(`  Base URL:     ${BASE_URL}`)
  console.log(`  Access Token: ${ACCESS_TOKEN.slice(0, 8)}...`)
  console.log('═══════════════════════════════════════════════════')

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const [name, fn] of [
    ['Company Profile', testCompanyProfile],
    ['Rechnungen',      testInvoices],
    ['Kontakte',        testContacts],
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
  console.log('')
  console.log('  Hinweis: Bexio-Token läuft nach ca. 1 Stunde ab.')
  console.log('  Im Produktivbetrieb wird er automatisch über den Refresh-Token erneuert.')
  console.log('')
}

main().catch(err => {
  console.error('\n💥  Unerwarteter Fehler:', err)
  process.exit(1)
})
