const URL = 'https://irudhiaixvmmmvprixge.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydWRoaWFpeHZtbW12cHJpeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTUzNiwiZXhwIjoyMDkyNTg1NTM2fQ.TuDlXr5Gmf6k3w9Z1_GqLkX1bcoFtlBjvdnFeRgc8sM'
const COMPANY = '00000000-0000-0000-0000-000000000001'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }

async function q(path, opts = {}) {
  const r = await fetch(`${URL}${path}`, { headers: H, ...opts })
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

// Get all events without budget_date that DO have a budget_amount
const openEvents = await q(`/liquidity_event_instances?company_id=eq.${COMPANY}&budget_date=is.null&budget_amount=not.is.null&select=id,step_name,project_id,direction,budget_amount,actual_date`)

// Get project info to spread dates sensibly
const projects = await q(`/projects?company_id=eq.${COMPANY}&status=eq.active&select=id,title`)
const projMap = Object.fromEntries(projects.map(p => [p.id, p.title]))

// Group by project to assign staggered dates
const byProject = {}
for (const evt of openEvents) {
  // Skip events already matched (have actual_date)
  if (evt.actual_date) continue
  // Skip tiny amounts (wrong associations from Betriebskosten project)
  if (parseFloat(evt.budget_amount) < 100 && evt.direction === 'income') continue

  if (!byProject[evt.project_id]) byProject[evt.project_id] = []
  byProject[evt.project_id].push(evt)
}

let updated = 0
const today = new Date()

for (const [projId, evts] of Object.entries(byProject)) {
  const projName = projMap[projId] ?? projId.slice(0,8)
  console.log(`\n→ ${projName}`)

  // Assign dates: Betriebskosten get monthly rolling dates, Solar income get near-future dates
  let monthOffset = 0

  for (const evt of evts) {
    let budgetDate

    if (['Bueromiete', 'Loehne', 'Versicherung', 'Fahrzeug-Leasing'].includes(evt.step_name)) {
      // Betriebskosten: set to 1st of upcoming months (June, July, etc.)
      const d = new Date(today)
      d.setMonth(d.getMonth() + 1 + monthOffset)
      d.setDate(1)
      budgetDate = d.toISOString().split('T')[0]
      // Don't increment monthOffset for each Betriebskosten - they're all in same month
    } else if (evt.direction === 'income') {
      // Solar income (Montage-Zahlung still pending): set 2-4 weeks from now
      const d = new Date(today)
      d.setDate(d.getDate() + 14 + (monthOffset * 7))
      budgetDate = d.toISOString().split('T')[0]
      monthOffset++
    } else {
      // Expense events with amounts: set to same month as related income
      const d = new Date(today)
      d.setMonth(d.getMonth() + 1)
      d.setDate(15)
      budgetDate = d.toISOString().split('T')[0]
    }

    await q(`/liquidity_event_instances?id=eq.${evt.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ budget_date: budgetDate })
    })
    console.log(`  ${evt.step_name}: ${parseFloat(evt.budget_amount).toFixed(0)} CHF → ${budgetDate}`)
    updated++
  }
}

console.log(`\nUpdated ${updated} events with budget_dates`)

// Final check
const allVisible = await q(`/liquidity_event_instances?company_id=eq.${COMPANY}&or=(budget_date.not.is.null,actual_date.not.is.null)&select=id`)
const total = await q(`/liquidity_event_instances?company_id=eq.${COMPANY}&select=id`)
console.log(`\nVisible events (have a date): ${allVisible.length} / ${total.length} total`)
