// Fix liquidity_event_instances: calculate date_deviation_days and amount_deviation
// for all records that have actual_date set

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydWRoaWFpeHZtbW12cHJpeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTUzNiwiZXhwIjoyMDkyNTg1NTM2fQ.TuDlXr5Gmf6k3w9Z1_GqLkX1bcoFtlBjvdnFeRgc8sM'
const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
}

async function main() {
  // 1. Fetch all events with actual_date
  const url = `${SUPABASE_URL}/rest/v1/liquidity_event_instances?company_id=eq.${COMPANY_ID}&actual_date=not.is.null&select=id,step_name,budget_date,actual_date,budget_amount,actual_amount`
  const resp = await fetch(url, { headers })
  const events = await resp.json()

  console.log(`Found ${events.length} events with actual_date`)

  for (const evt of events) {
    const budgetDate = new Date(evt.budget_date)
    const actualDate = new Date(evt.actual_date)
    const dateDev = Math.round((actualDate - budgetDate) / (1000 * 60 * 60 * 24))
    const amountDev = (parseFloat(evt.actual_amount) - parseFloat(evt.budget_amount)).toFixed(2)

    console.log(`  ${evt.step_name}: date_dev=${dateDev}, amount_dev=${amountDev}`)

    // 2. PATCH the row
    const patchUrl = `${SUPABASE_URL}/rest/v1/liquidity_event_instances?id=eq.${evt.id}`
    const patchResp = await fetch(patchUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        date_deviation_days: dateDev,
        amount_deviation: parseFloat(amountDev)
      })
    })

    if (!patchResp.ok) {
      console.error(`  ERROR patching ${evt.step_name}: ${patchResp.status} ${await patchResp.text()}`)
    }
  }

  console.log('Done!')
}

main().catch(console.error)
