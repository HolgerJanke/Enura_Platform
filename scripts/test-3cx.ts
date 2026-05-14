/**
 * 3CX REST API — Verbindungstest
 *
 * Führe aus mit:
 *   THREECX_API_URL=https://xyz.3cx.eu THREECX_API_KEY=xxx npx tsx scripts/test-3cx.ts
 *
 * Die API URL ist die Basis-URL deiner 3CX-Instanz (kein /api/v1 Suffix nötig).
 * Der API Key wird als X-API-Key Header gesendet.
 */

const API_URL = (process.env['THREECX_API_URL'] ?? '').replace(/\/$/, '')
const API_KEY = process.env['THREECX_API_KEY'] ?? ''

if (!API_URL || !API_KEY) {
  console.error('❌  Bitte setze THREECX_API_URL und THREECX_API_KEY als Umgebungsvariablen.')
  console.error('   Beispiel: THREECX_API_URL=https://xyz.3cx.eu THREECX_API_KEY=xxx npx tsx scripts/test-3cx.ts')
  process.exit(1)
}

async function get(path: string, query: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${API_URL}${path}`)
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-Key': API_KEY,
      'Accept': 'application/json',
    },
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`)
  return JSON.parse(text)
}

async function testExtensions() {
  console.log('\n📞  GET /api/v1/extensions ...')
  const data = await get('/api/v1/extensions')
  const arr = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? []
  console.log(`   ✅  ${arr.length} Durchwahl(en) gefunden`)
  if (arr.length > 0) {
    const e = arr[0] as Record<string, unknown>
    console.log(`   Felder: ${JSON.stringify(Object.keys(e))}`)
    console.log(`   Beispiel: ${JSON.stringify(e, null, 2).slice(0, 300)}`)
  }
  return arr
}

async function testCallLog() {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const startDate = since.toISOString()

  console.log('\n📋  GET /api/v1/calls?page=1&per_page=5 (letzte 7 Tage) ...')
  const data = await get('/api/v1/calls', {
    page: '1',
    per_page: '5',
    start_date: startDate,
  })

  const arr = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? []
  const total = (data as { total?: number; totalPages?: number }).total
    ?? (data as { total_count?: number }).total_count
    ?? arr.length
  console.log(`   ✅  ${arr.length} Anruf(e) auf Seite 1 (total ca. ${total})`)
  if (arr.length > 0) {
    const c = arr[0] as Record<string, unknown>
    console.log(`   Felder: ${JSON.stringify(Object.keys(c))}`)
    console.log(`   Beispiel: ${JSON.stringify(c, null, 2).slice(0, 400)}`)
  }
  return arr
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  3CX REST API — Verbindungstest')
  console.log(`  API URL:  ${API_URL}`)
  console.log(`  API Key:  ${API_KEY.slice(0, 4)}${'*'.repeat(Math.max(0, API_KEY.length - 4))}`)
  console.log('═══════════════════════════════════════════════════')

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const [name, fn] of [
    ['Extensions', testExtensions],
    ['Call Log',   testCallLog],
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
}

main().catch(err => {
  console.error('\n💥  Unerwarteter Fehler:', err)
  process.exit(1)
})
