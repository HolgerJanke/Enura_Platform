const URL = 'https://irudhiaixvmmmvprixge.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydWRoaWFpeHZtbW12cHJpeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTUzNiwiZXhwIjoyMDkyNTg1NTM2fQ.TuDlXr5Gmf6k3w9Z1_GqLkX1bcoFtlBjvdnFeRgc8sM'
const COMPANY = '00000000-0000-0000-0000-000000000001'
const HOLDING = '00000000-0000-0000-0000-000000000010'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }

async function q(path, opts = {}) {
  const r = await fetch(`${URL}${path}`, { headers: H, ...opts })
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

// 1. Get deployed processes
const processes = await q('/process_definitions?company_id=eq.' + COMPANY + '&status=eq.deployed&select=id,name,version')
console.log(`Deployed processes: ${processes.length}`)

// 2. Get active projects (with project_value for percentage resolution)
const projects = await q('/projects?company_id=eq.' + COMPANY + '&status=eq.active&select=id,title,project_value')
console.log(`Active projects: ${projects.length}\n`)

for (const proj of projects) {
  const projectValue = parseFloat(proj.project_value) || 0
  console.log(`→ ${proj.title} (Wert: ${projectValue > 0 ? projectValue.toFixed(2) + ' CHF' : 'n/a'})`)

  for (const proc of processes) {
    // Check if instance already exists
    const existing = await q(`/project_process_instances?project_id=eq.${proj.id}&process_id=eq.${proc.id}&select=id`)
    if (existing.length > 0) {
      console.log(`  [skip] "${proc.name}" already instantiated`)
      continue
    }

    // Get liquidity steps
    const steps = await q(`/process_steps?process_id=eq.${proc.id}&liquidity_marker=not.is.null&select=id,process_step_id,name,sort_order&order=sort_order`)
    if (steps.length === 0) continue

    // Create process instance
    const [inst] = await q('/project_process_instances', {
      method: 'POST',
      body: JSON.stringify({
        holding_id: HOLDING, company_id: COMPANY, project_id: proj.id,
        process_id: proc.id, process_version: proc.version, status: 'active'
      })
    })
    console.log(`  [new] Process instance "${proc.name}" → ${inst.id}`)

    // Get liquidity metadata
    const stepIds = steps.map(s => s.id)
    const liqData = await q(`/process_step_liquidity?process_id=eq.${proc.id}&step_id=in.(${stepIds.join(',')})&select=*`)

    const stepMap = Object.fromEntries(steps.map(s => [s.id, s]))
    let evtCount = 0

    for (const liq of liqData) {
      const step = stepMap[liq.step_id]
      if (!step) continue

      // Resolve percentage amounts to actual CHF
      let budgetAmount = liq.plan_amount != null ? parseFloat(liq.plan_amount) : null
      if (budgetAmount != null && liq.amount_type === 'percentage' && projectValue > 0) {
        const resolved = Math.round((budgetAmount / 100) * projectValue * 100) / 100
        console.log(`    ${step.name}: ${budgetAmount}% × ${projectValue} = ${resolved} CHF`)
        budgetAmount = resolved
      }

      await q('/liquidity_event_instances', {
        method: 'POST',
        body: JSON.stringify({
          holding_id: HOLDING, company_id: COMPANY,
          instance_id: inst.id, project_id: proj.id, process_id: proc.id,
          step_id: liq.step_id, process_step_id: step.process_step_id,
          step_name: step.name, marker_type: liq.marker_type,
          direction: liq.direction, plan_currency: liq.plan_currency,
          budget_amount: budgetAmount != null ? String(budgetAmount) : null,
          amount_type: liq.amount_type,
          plan_delay_days: liq.plan_delay_days ?? 0,
        })
      })
      evtCount++
    }
    console.log(`  [created] ${evtCount} liquidity events`)
  }
  console.log()
}

// Count total
const allEvents = await q('/liquidity_event_instances?company_id=eq.' + COMPANY + '&select=id')
console.log(`Total liquidity_event_instances: ${allEvents.length}`)

// Count open events with resolved amounts
const openEvents = await q('/liquidity_event_instances?company_id=eq.' + COMPANY + '&marker_type=eq.event&actual_date=is.null&budget_amount=not.is.null&select=id,step_name,budget_amount,amount_type')
console.log(`Open events (ready for Bexio matching): ${openEvents.length}`)
for (const e of openEvents) {
  console.log(`  ${e.step_name}: ${parseFloat(e.budget_amount).toFixed(2)} CHF ${e.amount_type === 'percentage' ? '(resolved from %)' : '(fixed)'}`)
}

console.log('\nDone!')
