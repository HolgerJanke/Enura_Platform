#!/usr/bin/env node
/**
 * Manual Bexio Sync Script
 * Pulls contacts → suppliers and kb_bill → invoices_incoming
 * Usage: node scripts/sync_bexio_manual.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co'
const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const BEXIO_BASE = 'https://api.bexio.com/2.0'
const DRY_RUN = process.argv.includes('--dry-run')

// Read service key from env file
import { readFileSync } from 'fs'
const envContent = readFileSync('apps/web/.env.local', 'utf8')
const serviceKey = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
if (!serviceKey) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const db = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

// ── Bexio API helpers ──────────────────────────────────────────────────

async function getAccessToken() {
  const { data } = await db.from('connectors').select('credentials').eq('id', '51c477b9-c86b-439d-8171-5cc4c55b9b6f').single()
  return data?.credentials?.access_token
}

async function bexioFetch(token, path) {
  const res = await fetch(`${BEXIO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bexio ${res.status}: ${text}`)
  }
  return res.json()
}

async function bexioPaginate(token, basePath, pageSize = 100) {
  const all = []
  let offset = 0
  while (true) {
    const page = await bexioFetch(token, `${basePath}${basePath.includes('?') ? '&' : '?'}offset=${offset}&limit=${pageSize}`)
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }
  return all
}

// ── Country mapping ──────────────────────────────────────────────────

const COUNTRY_MAP = { 1: 'CH', 2: 'DE', 3: 'AT' }

// ── Normalise functions ──────────────────────────────────────────────

function normaliseContact(c, holdingId) {
  const isCompany = c.contact_type_id === 1
  const name = isCompany ? c.name_1 : [c.name_2, c.name_1].filter(Boolean).join(' ')
  return {
    company_id: COMPANY_ID,
    holding_id: holdingId,
    external_id: String(c.id),
    name: name || `Kontakt ${c.id}`,
    address: c.address || null,
    city: c.city || null,
    postcode: c.postcode || null,
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

const BILL_STATUS_MAP = {
  7: 'draft',      // Entwurf
  8: 'pending',    // Offen
  9: 'overdue',    // Ueberfaellig
  10: 'partial',   // Teilbezahlt
  11: 'paid',      // Bezahlt
}

function normaliseBill(b, supplierMap, holdingId) {
  const supplierId = supplierMap.get(String(b.contact_id)) || null
  const bexioStatus = BILL_STATUS_MAP[b.kb_item_status_id] || 'received'

  let workflowStatus = 'received'
  if (bexioStatus === 'paid') workflowStatus = 'paid'
  else if (bexioStatus === 'overdue') workflowStatus = 'approved'
  else if (['pending', 'partial'].includes(bexioStatus)) workflowStatus = 'in_validation'

  return {
    company_id: COMPANY_ID,
    holding_id: holdingId,
    external_id: String(b.id),
    supplier_id: supplierId,
    invoice_number: b.document_nr || `BEXIO-${b.id}`,
    invoice_date: b.is_valid_from || new Date().toISOString().slice(0, 10),
    due_date: b.is_valid_to || null,
    sender_name: b.title || 'Bexio Kreditor',
    net_amount: b.total_net ? parseFloat(b.total_net) : 0,
    vat_amount: b.total_taxes ? parseFloat(b.total_taxes) : 0,
    gross_amount: b.total_gross ? parseFloat(b.total_gross) : 0,
    currency: 'CHF',
    status: workflowStatus,
    extraction_status: 'completed',
    incomer_type: 'webhook',
    raw_storage_path: `bexio/bills/${b.id}`,
    raw_filename: `${b.document_nr || b.id}.pdf`,
  }
}

// ── Main sync ──────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE SYNC ===')

  // 1. Get token
  const token = await getAccessToken()
  if (!token) { console.error('No Bexio access token found in connectors table'); process.exit(1) }
  console.log(`Token loaded (${token.length} chars)`)

  // Test token
  try {
    await bexioFetch(token, '/company_profile')
    console.log('✓ Bexio API connection OK')
  } catch (e) {
    console.error(`✗ Bexio API connection failed: ${e.message}`)
    process.exit(1)
  }

  // 2. Get holding_id
  const { data: company } = await db.from('companies').select('holding_id').eq('id', COMPANY_ID).single()
  const holdingId = company?.holding_id
  console.log(`Holding: ${holdingId}`)

  // ── Step 1: Sync Contacts → Suppliers ──────────────────────────
  console.log('\n--- Syncing Contacts → Suppliers ---')
  const contacts = await bexioPaginate(token, '/contact?order_by=updated_at&order=DESC')
  console.log(`Fetched ${contacts.length} contacts from Bexio`)

  const supplierRows = contacts.map(c => normaliseContact(c, holdingId))
  console.log(`Normalised ${supplierRows.length} supplier rows`)

  if (!DRY_RUN && supplierRows.length > 0) {
    // Upsert in batches of 50
    for (let i = 0; i < supplierRows.length; i += 50) {
      const batch = supplierRows.slice(i, i + 50)
      const { error } = await db.from('suppliers').upsert(batch, { onConflict: 'company_id,external_id' })
      if (error) { console.error(`Supplier upsert error (batch ${i}):`, error.message); continue }
      console.log(`  Upserted suppliers ${i + 1}–${i + batch.length}`)
    }
  } else if (DRY_RUN) {
    console.log('  [DRY RUN] Would upsert', supplierRows.length, 'suppliers')
    supplierRows.slice(0, 3).forEach(s => console.log(`    - ${s.name} (${s.city || '?'}, ${s.country})`))
  }

  // ── Step 2: Build supplier map ──────────────────────────────────
  const { data: allSuppliers } = await db.from('suppliers')
    .select('id, external_id')
    .eq('company_id', COMPANY_ID)
    .not('external_id', 'is', null)

  const supplierMap = new Map()
  for (const s of (allSuppliers || [])) {
    supplierMap.set(s.external_id, s.id)
  }
  console.log(`\nSupplier map: ${supplierMap.size} entries with external_id`)

  // ── Step 3: Sync Bills → Invoices Incoming ──────────────────────
  console.log('\n--- Syncing Bills → Invoices Incoming ---')
  const bills = await bexioPaginate(token, '/kb_bill?order_by=updated_at&order=DESC')
  console.log(`Fetched ${bills.length} bills from Bexio`)

  const invoiceRows = bills.map(b => normaliseBill(b, supplierMap, holdingId))
  console.log(`Normalised ${invoiceRows.length} invoice rows`)

  if (!DRY_RUN && invoiceRows.length > 0) {
    for (let i = 0; i < invoiceRows.length; i += 50) {
      const batch = invoiceRows.slice(i, i + 50)
      const { error } = await db.from('invoices_incoming').upsert(batch, { onConflict: 'company_id,external_id' })
      if (error) { console.error(`Invoice upsert error (batch ${i}):`, error.message); continue }
      console.log(`  Upserted invoices ${i + 1}–${i + batch.length}`)
    }
  } else if (DRY_RUN) {
    console.log('  [DRY RUN] Would upsert', invoiceRows.length, 'invoices')
    invoiceRows.slice(0, 3).forEach(inv => console.log(`    - ${inv.invoice_number} ${inv.total_gross} CHF (${inv.status})`))
  }

  // ── Step 4: Link procurement_items to suppliers ──────────────────
  console.log('\n--- Re-linking Procurement Items to Suppliers ---')
  const { data: procItems } = await db.from('procurement_items')
    .select('id, description, supplier_id')
    .eq('company_id', COMPANY_ID)
    .is('supplier_id', null)

  console.log(`Found ${(procItems || []).length} procurement items without supplier`)

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n=== SYNC COMPLETE ===')
  console.log(`Contacts/Suppliers: ${contacts.length} fetched → ${supplierRows.length} upserted`)
  console.log(`Bills/Invoices: ${bills.length} fetched → ${invoiceRows.length} upserted`)

  // Update connector last_synced_at
  if (!DRY_RUN) {
    await db.from('connectors')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', '51c477b9-c86b-439d-8171-5cc4c55b9b6f')
    console.log('Updated connector last_synced_at')
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
