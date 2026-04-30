/**
 * Standalone connector sync script
 * Runs Reonic and Leadnotes syncs directly without BullMQ/Redis
 *
 * Usage: cd apps/api && npx tsx ../../scripts/sync-connectors.ts
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydWRoaWFpeHZtbW12cHJpeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTUzNiwiZXhwIjoyMDkyNTg1NTM2fQ.TuDlXr5Gmf6k3w9Z1_GqLkX1bcoFtlBjvdnFeRgc8sM'

// Set env vars so the workers can find them
process.env.SUPABASE_URL = SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_KEY
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

async function syncReonic() {
  console.log('\n=== REONIC CRM SYNC ===')

  const { data: connector } = await db
    .from('connectors')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'reonic')
    .single()

  if (!connector) {
    console.log('  No Reonic connector found')
    return
  }

  console.log(`  Status: ${connector.status}`)
  console.log(`  Credentials: ${JSON.stringify(Object.keys(connector.credentials))}`)

  const { ReonicConnector } = await import('../apps/api/src/workers/connectors/reonic/worker.js')
  const worker = new ReonicConnector()

  try {
    console.log('  Validating connection...')
    await worker.validate({
      id: connector.id,
      company_id: COMPANY_ID,
      type: 'reonic',
      credentials: connector.credentials,
      config: connector.config ?? {},
      last_synced_at: connector.last_synced_at,
      sync_interval: connector.sync_interval_minutes ?? 15,
      status: connector.status,
    })
    console.log('  Connection valid!')
  } catch (err) {
    console.error('  Validation failed:', err instanceof Error ? err.message : err)
    return
  }

  console.log('  Starting sync...')
  const result = await worker.sync(COMPANY_ID, {
    id: connector.id,
    company_id: COMPANY_ID,
    type: 'reonic',
    credentials: connector.credentials,
    config: connector.config ?? {},
    last_synced_at: connector.last_synced_at,
    sync_interval: connector.sync_interval_minutes ?? 15,
    status: connector.status,
  })

  console.log(`  Fetched: ${result.recordsFetched}`)
  console.log(`  Written: ${result.recordsWritten}`)
  console.log(`  Skipped: ${result.recordsSkipped}`)
  console.log(`  Duration: ${result.durationMs}ms`)
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`)
    for (const e of result.errors.slice(0, 5)) {
      console.log(`    - [${e.code}] ${e.message}`)
    }
  }

  if (result.success) {
    await db.from('connectors')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', connector.id)
    console.log('  last_synced_at updated')
  }
}

async function syncLeadnotes() {
  console.log('\n=== LEADNOTES SYNC ===')

  const { data: connector } = await db
    .from('connectors')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'leadnotes')
    .single()

  if (!connector) {
    console.log('  No Leadnotes connector found')
    return
  }

  console.log(`  Status: ${connector.status}`)
  console.log(`  Credentials: ${JSON.stringify(Object.keys(connector.credentials))}`)

  const { leadnotesConnector } = await import('../apps/api/src/workers/connectors/leadnotes/worker.js')

  try {
    console.log('  Validating connection...')
    await leadnotesConnector.validate({
      id: connector.id,
      company_id: COMPANY_ID,
      type: 'leadnotes',
      credentials: connector.credentials,
      config: connector.config ?? {},
      last_synced_at: connector.last_synced_at,
      sync_interval: connector.sync_interval_minutes ?? 15,
      status: connector.status,
    })
    console.log('  Connection valid!')
  } catch (err) {
    console.error('  Validation failed:', err instanceof Error ? err.message : err)
    return
  }

  console.log('  Starting sync...')
  const result = await leadnotesConnector.sync(COMPANY_ID, {
    id: connector.id,
    company_id: COMPANY_ID,
    type: 'leadnotes',
    credentials: connector.credentials,
    config: connector.config ?? {},
    last_synced_at: connector.last_synced_at,
    sync_interval: connector.sync_interval_minutes ?? 15,
    status: connector.status,
  })

  console.log(`  Fetched: ${result.recordsFetched}`)
  console.log(`  Written: ${result.recordsWritten}`)
  console.log(`  Skipped: ${result.recordsSkipped}`)
  console.log(`  Duration: ${result.durationMs}ms`)
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`)
    for (const e of result.errors.slice(0, 5)) {
      console.log(`    - [${e.code}] ${e.message}`)
    }
  }

  if (result.success) {
    await db.from('connectors')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', connector.id)
    console.log('  last_synced_at updated')
  }
}

async function syncBexio() {
  console.log('\n=== BEXIO SYNC ===')

  const { data: connector } = await db
    .from('connectors')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'bexio')
    .single()

  if (!connector) {
    console.log('  No Bexio connector found')
    return
  }

  if (!connector.credentials?.access_token) {
    console.log('  Bexio PAT not configured — skipping')
    return
  }

  console.log(`  Status: ${connector.status}`)

  const { bexioConnector } = await import('../apps/api/src/workers/connectors/bexio/worker.js')

  try {
    console.log('  Validating connection...')
    await bexioConnector.validate({
      id: connector.id,
      company_id: COMPANY_ID,
      type: 'bexio',
      credentials: connector.credentials,
      config: connector.config ?? {},
      last_synced_at: connector.last_synced_at,
      sync_interval: connector.sync_interval_minutes ?? 60,
      status: connector.status,
    })
    console.log('  Connection valid!')
  } catch (err) {
    console.error('  Validation failed:', err instanceof Error ? err.message : err)
    return
  }

  console.log('  Starting sync...')
  const result = await bexioConnector.sync(COMPANY_ID, {
    id: connector.id,
    company_id: COMPANY_ID,
    type: 'bexio',
    credentials: connector.credentials,
    config: connector.config ?? {},
    last_synced_at: connector.last_synced_at,
    sync_interval: connector.sync_interval_minutes ?? 60,
    status: connector.status,
  })

  console.log(`  Fetched: ${result.recordsFetched}`)
  console.log(`  Written: ${result.recordsWritten}`)
  console.log(`  Skipped: ${result.recordsSkipped}`)
  console.log(`  Duration: ${result.durationMs}ms`)
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`)
    for (const e of result.errors.slice(0, 5)) {
      console.log(`    - [${e.code}] ${e.message}`)
    }
  }

  if (result.success) {
    await db.from('connectors')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', connector.id)
    console.log('  last_synced_at updated')
  }
}

async function main() {
  console.log('Enura Platform — Connector Sync')
  console.log(`Company: ${COMPANY_ID}`)
  console.log(`Supabase: ${SUPABASE_URL}`)

  const target = process.argv[2] // optional: 'reonic', 'leadnotes', 'bexio'

  if (!target || target === 'reonic') await syncReonic()
  if (!target || target === 'leadnotes') await syncLeadnotes()
  if (!target || target === 'bexio') await syncBexio()

  console.log('\nDone!')
}

main().catch(console.error)
