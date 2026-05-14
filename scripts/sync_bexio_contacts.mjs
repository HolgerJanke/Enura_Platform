#!/usr/bin/env node
/**
 * Bexio Contact → Supplier Sync (zero dependencies)
 * Usage: node scripts/sync_bexio_contacts.mjs [--dry-run]
 */
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co'
const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const DRY_RUN = process.argv.includes('--dry-run')

const envContent = readFileSync('apps/web/.env.local', 'utf8')
const SERVICE_KEY = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const COUNTRY_MAP = { 1: 'CH', 2: 'DE', 3: 'AT', 4: 'FR', 5: 'IT' }

// ── Supabase REST helpers ──

async function supabaseGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabaseUpsert(table, rows, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase UPSERT ${table}: ${res.status} ${text}`)
  }
  return res.status
}

async function supabasePatch(table, filter, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  })
  return res.status
}

// ── Bexio API helpers ──

async function bexioGet(token, path) {
  const res = await fetch(`https://api.bexio.com/2.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Bexio ${res.status} on ${path}`)
  return res.json()
}

async function paginateAll(token, basePath) {
  const all = []
  let offset = 0
  const limit = 500
  while (true) {
    const sep = basePath.includes('?') ? '&' : '?'
    const page = await bexioGet(token, `${basePath}${sep}offset=${offset}&limit=${limit}`)
    all.push(...page)
    process.stdout.write(`  Fetched ${all.length} contacts...\r`)
    if (page.length < limit) break
    offset += limit
  }
  console.log(`  Fetched ${all.length} contacts total`)
  return all
}

// ── Normalise ──

function normaliseContact(c, holdingId) {
  const isCompany = c.contact_type_id === 1
  const name = isCompany
    ? (c.name_1 || `Kontakt ${c.id}`)
    : [c.name_2, c.name_1].filter(Boolean).join(' ') || `Kontakt ${c.id}`

  return {
    company_id: COMPANY_ID,
    holding_id: holdingId,
    external_id: String(c.id),
    name,
    address_line_1: c.address || null,
    postal_code: c.postcode || null,
    city: c.city || null,
    country: COUNTRY_MAP[c.country_id] || 'CH',
    vat_number: null,
    iban: null,
    contact_name: isCompany ? null : name,
    contact_email: c.mail || null,
    contact_phone: c.phone_fixed || null,
    preferred_payment_days: 30,
    is_active: true,
  }
}

// ── Main ──

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE SYNC ===')

  // Get token
  const [connector] = await supabaseGet('connectors', 'id=eq.51c477b9-c86b-439d-8171-5cc4c55b9b6f&select=credentials')
  const token = connector?.credentials?.access_token
  if (!token) { console.error('No Bexio token'); process.exit(1) }

  // Test
  const profile = await bexioGet(token, '/company_profile')
  console.log(`Bexio: ${profile.name} (${profile.legal_form})\n`)

  // Get holding_id
  const [company] = await supabaseGet('companies', `id=eq.${COMPANY_ID}&select=holding_id`)
  const holdingId = company?.holding_id

  // Fetch contacts
  console.log('Fetching Bexio contacts...')
  const contacts = await paginateAll(token, '/contact?order_by=updated_at&order=DESC')

  // Normalise
  const rows = contacts.map(c => normaliseContact(c, holdingId))
  const companies = contacts.filter(c => c.contact_type_id === 1).length
  const persons = contacts.filter(c => c.contact_type_id === 2).length
  console.log(`  Firmen: ${companies}, Personen: ${persons}\n`)

  if (DRY_RUN) {
    console.log('Sample suppliers:')
    rows.slice(0, 10).forEach(s =>
      console.log(`  - ${s.name} | ${s.city || '?'}, ${s.country} | ${s.contact_email || '-'}`)
    )
    return
  }

  // Upsert in batches of 50
  console.log('Upserting suppliers...')
  let ok = 0, fail = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    try {
      await supabaseUpsert('suppliers', batch)
      ok += batch.length
      console.log(`  ✓ ${i + 1}–${i + batch.length}`)
    } catch (e) {
      console.error(`  ✗ Batch ${i}: ${e.message}`)
      fail++
    }
  }

  // Update last_synced_at
  await supabasePatch('connectors', 'id=eq.51c477b9-c86b-439d-8171-5cc4c55b9b6f', {
    last_synced_at: new Date().toISOString(),
  })

  console.log(`\n=== FERTIG ===`)
  console.log(`Upserted: ${ok} Lieferanten`)
  if (fail) console.log(`Fehler: ${fail} Batches`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
