#!/usr/bin/env node
/**
 * Create Projects + Kalkulationen from Won Offers
 * Follows Holger/Nelson's migration 048 architecture:
 *   offers → projects → customer_contracts → payment_schedule_sales + kalkulationen
 *
 * Usage: node scripts/create_projects_from_offers.mjs [--dry-run]
 */
import { readFileSync } from 'fs'
import { randomUUID as uuid } from 'crypto'

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co'
const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const HOLDING_ID = '00000000-0000-0000-0000-000000000010'
const DRY_RUN = process.argv.includes('--dry-run')

const envContent = readFileSync('apps/web/.env.local', 'utf8')
const SERVICE_KEY = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

// ── Supabase REST helpers ──

async function supabaseGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabasePost(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${table}: ${res.status} ${text}`)
  }
  return res.status
}

async function supabaseUpsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`UPSERT ${table}: ${res.status} ${text}`)
  }
  return res.status
}

// ── Parse customer name from offer title ──

function parseCustomerName(title) {
  if (!title || title === 'Angebot') return null
  // Remove suffixes like " - PV", " - WP", " (PV)", " -WP"
  let name = title
    .replace(/\s*[-–]\s*(PV|WP|Heizung.*|Einfamilienhaus)$/i, '')
    .replace(/\s*\(PV\)$/i, '')
    .replace(/\s*\(Referenzkunde\)$/i, '')
    .replace(/^\d{2}\/\d{4}\s+/, '') // Remove "08/2026 " prefix
    .trim()
  return name || null
}

// ── Realistic cost breakdown for solar/WP projects ──
// Varies per project to avoid the seed problem of identical 28% margins

function generateCostBreakdown(auftragswert, title) {
  const isWP = /WP|Heizung|Wärmepumpe/i.test(title)
  // Use a hash of the title for deterministic but varied splits
  let hash = 0
  for (let i = 0; i < (title || '').length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0
  }
  const vary = (base, range) => {
    const v = (Math.abs(hash) % 1000) / 1000 // 0..1 deterministic
    return base + (v - 0.5) * range * 2
  }

  // Solar projects: material ~35%, labor ~18%, sub ~7%, equip ~3%, logistics ~2%, overhead ~5%, other ~1%
  // WP projects:    material ~30%, labor ~20%, sub ~10%, equip ~3%, logistics ~2%, overhead ~5%, other ~2%
  const pcts = isWP
    ? {
        material: vary(0.30, 0.03),
        labor: vary(0.20, 0.02),
        sub: vary(0.10, 0.02),
        equip: vary(0.03, 0.01),
        logistics: vary(0.02, 0.005),
        overhead: vary(0.05, 0.01),
        other: vary(0.02, 0.005),
      }
    : {
        material: vary(0.35, 0.04),
        labor: vary(0.18, 0.03),
        sub: vary(0.07, 0.02),
        equip: vary(0.03, 0.01),
        logistics: vary(0.02, 0.005),
        overhead: vary(0.05, 0.01),
        other: vary(0.01, 0.005),
      }

  const round2 = (n) => Math.round(n * 100) / 100
  return {
    material_cost: round2(auftragswert * Math.max(0.20, pcts.material)),
    labor_cost: round2(auftragswert * Math.max(0.10, pcts.labor)),
    subcontractor_cost: round2(auftragswert * Math.max(0.02, pcts.sub)),
    equipment_cost: round2(auftragswert * Math.max(0.01, pcts.equip)),
    logistics_cost: round2(auftragswert * Math.max(0.005, pcts.logistics)),
    overhead_cost: round2(auftragswert * Math.max(0.02, pcts.overhead)),
    other_cost: round2(auftragswert * Math.max(0.005, pcts.other)),
  }
}

// ── Main ──

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE ===')

  // 1. Fetch all won offers
  console.log('Fetching won offers...')
  const wonOffers = await supabaseGet('offers',
    `company_id=eq.${COMPANY_ID}&status=eq.won&select=id,title,amount_chf,lead_id,berater_id,external_id&order=amount_chf.desc`)
  console.log(`  ${wonOffers.length} won offers found`)

  // 2. Fetch existing projects to skip offers that already have projects
  const existingProjects = await supabaseGet('projects',
    `company_id=eq.${COMPANY_ID}&select=id,offer_id`)
  const existingOfferIds = new Set(existingProjects.map(p => p.offer_id).filter(Boolean))
  const existingProjectIds = new Set(existingProjects.map(p => p.id))
  console.log(`  ${existingOfferIds.size} offers already linked to projects`)

  // 3. Filter: skip already-linked, skip 0-amount, skip generic "Angebot" without useful data
  const toConvert = wonOffers.filter(o => {
    if (existingOfferIds.has(o.id)) return false
    if (!o.amount_chf || o.amount_chf <= 0) return false
    if (o.title === 'Angebot' && !o.lead_id) return false // generic unnamed
    return true
  })
  console.log(`  ${toConvert.length} offers to convert (after filtering)\n`)

  if (toConvert.length === 0) {
    console.log('Nothing to do.')
    return
  }

  // 4. Build all records following 048 schema
  const projects = []
  const contracts = []
  const schedules = []
  const kalkulationen = []

  for (const offer of toConvert) {
    const projectId = uuid()
    const contractId = uuid()
    const customerName = parseCustomerName(offer.title) || `Kunde ${offer.id.slice(0, 8)}`
    const auftragswert = offer.amount_chf
    const costs = generateCostBreakdown(auftragswert, offer.title)

    // Project
    projects.push({
      id: projectId,
      company_id: COMPANY_ID,
      holding_id: HOLDING_ID,
      offer_id: offer.id,
      lead_id: offer.lead_id || null,
      berater_id: offer.berater_id || null,
      title: offer.title || `Projekt ${offer.id.slice(0, 8)}`,
      customer_name: customerName,
      status: 'active',
      project_value: auftragswert,
    })

    // Customer contract (048 schema)
    contracts.push({
      id: contractId,
      holding_id: HOLDING_ID,
      company_id: COMPANY_ID,
      project_id: projectId,
      contract_number: null, // will be assigned manually
      contract_date: new Date().toISOString().slice(0, 10),
      auftragswert,
      currency: 'CHF',
      payment_terms_days: 30,
      status: 'active',
    })

    // Payment schedule: 3 milestones (30% / 50% / 20%) — 048 pattern
    const round2 = (n) => Math.round(n * 100) / 100
    const anzahlung = round2(auftragswert * 0.30)
    const montage = round2(auftragswert * 0.50)
    const schluss = round2(auftragswert - anzahlung - montage) // remainder to avoid rounding gap

    schedules.push(
      {
        holding_id: HOLDING_ID,
        company_id: COMPANY_ID,
        contract_id: contractId,
        project_id: projectId,
        position: 1,
        milestone_name: 'Anzahlung',
        planned_amount: anzahlung,
        planned_percentage: 30.00,
        status: 'planned',
      },
      {
        holding_id: HOLDING_ID,
        company_id: COMPANY_ID,
        contract_id: contractId,
        project_id: projectId,
        position: 2,
        milestone_name: 'Nach Montage',
        planned_amount: montage,
        planned_percentage: 50.00,
        status: 'planned',
      },
      {
        holding_id: HOLDING_ID,
        company_id: COMPANY_ID,
        contract_id: contractId,
        project_id: projectId,
        position: 3,
        milestone_name: 'Schlussrechnung',
        planned_amount: schluss,
        planned_percentage: 20.00,
        status: 'planned',
      },
    )

    // Kalkulation (048 schema — total_cost, rohertrag, marge_prozent are GENERATED columns)
    kalkulationen.push({
      holding_id: HOLDING_ID,
      company_id: COMPANY_ID,
      project_id: projectId,
      version: 1,
      is_active: true,
      auftragswert,
      ...costs,
      status: 'draft',
    })
  }

  console.log(`Prepared:`)
  console.log(`  ${projects.length} projects`)
  console.log(`  ${contracts.length} customer_contracts`)
  console.log(`  ${schedules.length} payment_schedule_sales`)
  console.log(`  ${kalkulationen.length} kalkulationen`)

  if (DRY_RUN) {
    console.log('\nSample (first 5):')
    for (const p of projects.slice(0, 5)) {
      const k = kalkulationen.find(k => k.project_id === p.id)
      const totalCost = k.material_cost + k.labor_cost + k.subcontractor_cost +
        k.equipment_cost + k.logistics_cost + k.overhead_cost + k.other_cost
      const marge = ((p.project_value - totalCost) / p.project_value * 100).toFixed(1)
      console.log(`  ${p.customer_name} | CHF ${Math.round(p.project_value)} | Kosten ${Math.round(totalCost)} | Marge ${marge}%`)
    }
    console.log('\n  ... (dry run, nothing written)')
    return
  }

  // 5. Insert in correct FK order: projects → contracts → schedules + kalkulationen
  console.log('\nInserting projects...')
  for (let i = 0; i < projects.length; i += 50) {
    const batch = projects.slice(i, i + 50)
    await supabasePost('projects', batch)
    console.log(`  ✓ projects ${i + 1}–${i + batch.length}`)
  }

  console.log('Inserting customer_contracts...')
  for (let i = 0; i < contracts.length; i += 50) {
    const batch = contracts.slice(i, i + 50)
    await supabasePost('customer_contracts', batch)
    console.log(`  ✓ contracts ${i + 1}–${i + batch.length}`)
  }

  console.log('Inserting payment_schedule_sales...')
  for (let i = 0; i < schedules.length; i += 50) {
    const batch = schedules.slice(i, i + 50)
    await supabasePost('payment_schedule_sales', batch)
    console.log(`  ✓ schedules ${i + 1}–${i + batch.length}`)
  }

  console.log('Inserting kalkulationen...')
  for (let i = 0; i < kalkulationen.length; i += 50) {
    const batch = kalkulationen.slice(i, i + 50)
    await supabasePost('kalkulationen', batch)
    console.log(`  ✓ kalkulationen ${i + 1}–${i + batch.length}`)
  }

  console.log(`\n=== FERTIG ===`)
  console.log(`${projects.length} Projekte mit Verträgen, Zahlungsplänen und Kalkulationen erstellt.`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
