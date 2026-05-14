/**
 * Leadnotes API — Verbindungstest
 *
 * Führe aus mit:
 *   LEADNOTES_API_KEY=xxx npx tsx scripts/test-leadnotes.ts
 *
 * Optional: LEADNOTES_BASE_URL falls du eine abweichende Instanz hast
 *   (Standard: https://api.leadnotes.io)
 */

const API_KEY  = process.env['LEADNOTES_API_KEY']  ?? ''
const BASE_URL = (process.env['LEADNOTES_BASE_URL'] ?? 'https://api.leadnotes.io').replace(/\/$/, '')

if (!API_KEY) {
  console.error('❌  Bitte setze LEADNOTES_API_KEY als Umgebungsvariable.')
  console.error('   Beispiel: LEADNOTES_API_KEY=xxx npx tsx scripts/test-leadnotes.ts')
  process.exit(1)
}

async function get(path: string, query: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`)
  return JSON.parse(text)
}

async function testLeads() {
  console.log('\n👤  GET /api/v1/leads?page=1&per_page=5 ...')
  const data = await get('/api/v1/leads', {
    page: '1',
    per_page: '5',
    sort: 'created_at',
    order: 'desc',
  })

  const meta   = (data as { meta?: Record<string, unknown> }).meta ?? {}
  const leads  = (data as { data?: unknown[] }).data ?? (Array.isArray(data) ? data : [])
  const total  = meta['total'] ?? leads.length

  console.log(`   ✅  ${leads.length} Lead(s) auf Seite 1 (total: ${total})`)
  console.log(`   Meta: ${JSON.stringify(meta)}`)

  if (leads.length > 0) {
    const l = leads[0] as Record<string, unknown>
    console.log(`   Felder: ${JSON.stringify(Object.keys(l))}`)
    console.log(`   Beispiel: ${JSON.stringify(l, null, 2).slice(0, 400)}`)
  }
  return leads
}

async function testLeadsSinceYesterday() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const since = yesterday.toISOString()

  console.log(`\n⚡  GET /api/v1/leads?created_after=${since.slice(0, 10)} ...`)
  const data = await get('/api/v1/leads', {
    page: '1',
    per_page: '100',
    sort: 'created_at',
    order: 'desc',
    created_after: since,
  })

  const leads = (data as { data?: unknown[] }).data ?? (Array.isArray(data) ? data : [])
  const meta  = (data as { meta?: Record<string, unknown> }).meta ?? {}
  console.log(`   ✅  ${leads.length} Lead(s) seit gestern (has_more: ${meta['has_more'] ?? '?'})`)
  return leads
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Leadnotes API — Verbindungstest')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  API Key:  ${API_KEY.slice(0, 4)}${'*'.repeat(Math.max(0, API_KEY.length - 4))}`)
  console.log('═══════════════════════════════════════════════════')

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const [name, fn] of [
    ['Leads (paginiert)',  testLeads],
    ['Leads (seit gestern)', testLeadsSinceYesterday],
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
