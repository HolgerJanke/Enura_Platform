#!/usr/bin/env node
/**
 * Fix Project Data for Alpen Energie
 * Fills gaps left by the initial offer→project conversion:
 *   1. Create phase definitions (Solar-Projektphasen)
 *   2. Assign phase_id to all projects (for Kanban)
 *   3. Add planned_dates to payment_schedule_sales (for Liquiditätsplanung)
 *   4. Set contract_number on contracts that don't have one
 *
 * Usage: node scripts/fix_project_data.mjs [--dry-run]
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
  if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${await res.text()}`)
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
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${await res.text()}`)
}

// ── Main ──

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE ===')

  // ═══════════════════════════════════════════════════════════════
  // 1. CREATE PHASE DEFINITIONS (Solar-Projektphasen)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 1. Phase Definitions ---')

  const existingPhases = await supabaseGet('phase_definitions',
    `company_id=eq.${COMPANY_ID}&select=id,phase_number,name`)

  if (existingPhases.length > 0) {
    console.log(`  Already ${existingPhases.length} phases exist, skipping.`)
  } else {
    // Standard Solar-Projektphasen für Alpen Energie
    const phases = [
      { phase_number: 1, name: 'Auftrag erhalten', color: '#6366f1', stall_threshold_days: 5, description: 'Vertrag unterschrieben, Projekt angelegt' },
      { phase_number: 2, name: 'Planung & Bewilligung', color: '#3b82f6', stall_threshold_days: 14, description: 'Technische Planung, Netzgesuch, Baubewilligung' },
      { phase_number: 3, name: 'Material bestellt', color: '#8b5cf6', stall_threshold_days: 21, description: 'Module, Wechselrichter, Speicher bestellt' },
      { phase_number: 4, name: 'Montage geplant', color: '#f59e0b', stall_threshold_days: 14, description: 'Montagetermin vereinbart, Gerüst organisiert' },
      { phase_number: 5, name: 'Montage läuft', color: '#ef4444', stall_threshold_days: 7, description: 'Installation auf dem Dach' },
      { phase_number: 6, name: 'Elektro & Inbetriebnahme', color: '#10b981', stall_threshold_days: 10, description: 'DC/AC Anschluss, Netzanmeldung, Inbetriebnahme' },
      { phase_number: 7, name: 'Abnahme & Abschluss', color: '#22c55e', stall_threshold_days: 14, description: 'Abnahmeprotokoll, Schlussrechnung, Fördergeld' },
    ]

    const phaseRows = phases.map(p => ({
      id: uuid(),
      company_id: COMPANY_ID,
      ...p,
    }))

    if (!DRY_RUN) {
      await supabasePost('phase_definitions', phaseRows)
      console.log(`  ✓ ${phaseRows.length} Phasen erstellt`)
    } else {
      phaseRows.forEach(p => console.log(`  [DRY] Phase ${p.phase_number}: ${p.name}`))
    }

    // Store for step 2
    existingPhases.push(...phaseRows)
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. ASSIGN PHASE_ID TO ALL PROJECTS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 2. Assign phase_id to projects ---')

  const allPhases = existingPhases.length > 0
    ? existingPhases
    : await supabaseGet('phase_definitions', `company_id=eq.${COMPANY_ID}&select=id,phase_number&order=phase_number.asc`)

  const projects = await supabaseGet('projects',
    `company_id=eq.${COMPANY_ID}&phase_id=is.null&select=id,title,offer_id,project_value,created_at`)

  console.log(`  ${projects.length} projects without phase_id`)

  if (projects.length > 0 && allPhases.length > 0) {
    // Distribute projects across phases based on offer amount (higher value = further along)
    // Sort by project_value descending — bigger projects are likely further along
    const sorted = [...projects].sort((a, b) => (b.project_value || 0) - (a.project_value || 0))

    // Top 10% → Phase 7 (Abschluss), next 15% → Phase 6, etc.
    const distribution = [
      { pct: 0.08, phaseNum: 7 },  // 8% in Abschluss
      { pct: 0.10, phaseNum: 6 },  // 10% in Elektro
      { pct: 0.15, phaseNum: 5 },  // 15% in Montage läuft
      { pct: 0.15, phaseNum: 4 },  // 15% in Montage geplant
      { pct: 0.20, phaseNum: 3 },  // 20% in Material bestellt
      { pct: 0.17, phaseNum: 2 },  // 17% in Planung
      { pct: 0.15, phaseNum: 1 },  // 15% in Auftrag erhalten
    ]

    const phaseMap = new Map(allPhases.map(p => [p.phase_number, p.id]))
    let idx = 0

    for (const dist of distribution) {
      const count = Math.ceil(sorted.length * dist.pct)
      const phaseId = phaseMap.get(dist.phaseNum)
      if (!phaseId) continue

      const batch = sorted.slice(idx, idx + count)
      if (batch.length > 0 && !DRY_RUN) {
        const ids = batch.map(p => p.id)
        // Patch in groups of 50 (URL length limit)
        // Only set phase_id (not current_phase) to avoid broken log_phase_transition trigger
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50)
          const filter = `id=in.(${chunk.join(',')})`
          await supabasePatch('projects', filter, {
            phase_id: phaseId,
          })
        }
        console.log(`  ✓ Phase ${dist.phaseNum}: ${batch.length} projects`)
      } else if (batch.length > 0) {
        console.log(`  [DRY] Phase ${dist.phaseNum}: ${batch.length} projects`)
      }
      idx += count
    }

    // Any remaining → Phase 1
    if (idx < sorted.length) {
      const remaining = sorted.slice(idx)
      const phase1Id = phaseMap.get(1)
      if (phase1Id && !DRY_RUN) {
        const ids = remaining.map(p => p.id)
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50)
          await supabasePatch('projects', `id=in.(${chunk.join(',')})`, {
            phase_id: phase1Id,
          })
        }
        console.log(`  ✓ Phase 1 (rest): ${remaining.length} projects`)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. ADD PLANNED_DATES TO PAYMENT SCHEDULES
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 3. Add planned_dates to payment schedules ---')

  const schedulesNoDates = await supabaseGet('payment_schedule_sales',
    `company_id=eq.${COMPANY_ID}&planned_date=is.null&select=id,contract_id,project_id,position,milestone_name`)

  console.log(`  ${schedulesNoDates.length} schedules without planned_date`)

  if (schedulesNoDates.length > 0) {
    // Get contract dates
    const contractIds = [...new Set(schedulesNoDates.map(s => s.contract_id))]
    const contracts = await supabaseGet('customer_contracts',
      `id=in.(${contractIds.join(',')})&select=id,contract_date`)
    const contractDateMap = new Map(contracts.map(c => [c.id, c.contract_date]))

    // For each schedule, calculate planned_date based on position:
    // Position 1 (Anzahlung): contract_date + 14 days
    // Position 2 (Nach Montage): contract_date + 60 days
    // Position 3 (Schlussrechnung): contract_date + 90 days
    const offsets = { 1: 14, 2: 60, 3: 90 }

    let updated = 0
    // Group by contract to batch updates
    const byContract = new Map()
    for (const s of schedulesNoDates) {
      if (!byContract.has(s.contract_id)) byContract.set(s.contract_id, [])
      byContract.get(s.contract_id).push(s)
    }

    for (const [contractId, items] of byContract) {
      const baseDate = contractDateMap.get(contractId) || new Date().toISOString().slice(0, 10)

      for (const s of items) {
        const daysOffset = offsets[s.position] || (s.position * 30)
        const date = new Date(baseDate)
        date.setDate(date.getDate() + daysOffset)
        const plannedDate = date.toISOString().slice(0, 10)

        if (!DRY_RUN) {
          await supabasePatch('payment_schedule_sales', `id=eq.${s.id}`, {
            planned_date: plannedDate,
          })
          updated++
          if (updated % 100 === 0) process.stdout.write(`  Updated ${updated}...\r`)
        }
      }
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would update ${schedulesNoDates.length} schedules with dates`)
    } else {
      console.log(`  ✓ ${updated} schedules updated with planned_date`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. SET CONTRACT NUMBERS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 4. Set contract numbers ---')

  const contractsNoNumber = await supabaseGet('customer_contracts',
    `company_id=eq.${COMPANY_ID}&contract_number=is.null&select=id,created_at&order=created_at.asc`)

  console.log(`  ${contractsNoNumber.length} contracts without number`)

  if (contractsNoNumber.length > 0) {
    // Find the highest existing contract number
    const existingContracts = await supabaseGet('customer_contracts',
      `company_id=eq.${COMPANY_ID}&contract_number=not.is.null&select=contract_number&order=contract_number.desc&limit=1`)

    let nextNum = 6 // Start after AE-2026-005
    if (existingContracts.length > 0) {
      const match = existingContracts[0].contract_number?.match(/AE-\d+-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }

    let updated = 0
    for (const c of contractsNoNumber) {
      const num = String(nextNum++).padStart(3, '0')
      if (!DRY_RUN) {
        await supabasePatch('customer_contracts', `id=eq.${c.id}`, {
          contract_number: `AE-2026-${num}`,
        })
        updated++
        if (updated % 50 === 0) process.stdout.write(`  Updated ${updated}...\r`)
      }
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would number AE-2026-006 through AE-2026-${String(nextNum - 1).padStart(3, '0')}`)
    } else {
      console.log(`  ✓ ${updated} contracts numbered`)
    }
  }

  console.log('\n=== FERTIG ===')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
