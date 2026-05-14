/**
 * Standalone sync runner — triggers connector sync without the full Fastify API.
 *
 * Usage:
 *   cd apps/api
 *   npx tsx src/run-sync.ts [reonic|leadnotes|bexio|all]
 *
 * Reads connector config + credentials from the DB, runs the sync worker,
 * writes results back to connector_sync_log.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

// Load .env from apps/api/.env
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
} catch { /* .env optional */ }
import { registerConnector, getConnectorImpl } from './workers/connectors/registry.js'
import { ReonicConnector } from './workers/connectors/reonic/worker.js'
import { leadnotesConnector } from './workers/connectors/leadnotes/worker.js'
import { bexioConnector } from './workers/connectors/bexio/worker.js'
import { ThreeCXConnector } from './workers/connectors/threecx/worker.js'
import { writeSyncResult } from './workers/connectors/sync-writer.js'
import type { ConnectorConfig } from './workers/connectors/base.js'
import { matchBexioPayments } from './workers/liquidity/bexio-matcher.js'

// Register all connector implementations
registerConnector(new ReonicConnector())
registerConnector(leadnotesConnector)
registerConnector(bexioConnector)
registerConnector(new ThreeCXConnector())

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function runSync(connectorType: string): Promise<void> {
  const db = getServiceClient()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Syncing: ${connectorType.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)

  // Fetch connector config from DB
  const { data: connector, error } = await db
    .from('connectors')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('type', connectorType)
    .single()

  if (error || !connector) {
    console.error(`  ❌ Connector "${connectorType}" not found in DB for company ${COMPANY_ID}`)
    return
  }

  const config = connector as unknown as ConnectorConfig
  const creds = config.credentials as Record<string, unknown>

  // Check if credentials exist
  if (!creds || Object.keys(creds).length === 0) {
    console.error(`  ❌ No credentials configured for ${connectorType}`)
    console.error(`     → Bitte Credentials in der DB oder über die Settings-Seite hinterlegen`)
    return
  }

  console.log(`  Status: ${config.status}`)
  console.log(`  Last synced: ${config.last_synced_at ?? 'never'}`)
  console.log(`  Credentials: ${Object.keys(creds).join(', ')}`)
  console.log()

  try {
    const impl = getConnectorImpl(connectorType)
    const startedAt = new Date()

    // Validate credentials first
    console.log(`  → Validating credentials...`)
    await impl.validate(config)
    console.log(`  ✅ Credentials valid`)

    // Run sync
    console.log(`  → Starting sync...`)
    const result = await impl.sync(COMPANY_ID, config)

    // Write sync result to DB
    await writeSyncResult(config.id, COMPANY_ID, startedAt, result)

    // Update connector status + last_synced_at
    await db
      .from('connectors')
      .update({
        status: result.success ? 'active' : 'error',
        last_synced_at: new Date().toISOString(),
        last_error: result.errors.length > 0 ? result.errors[0]?.message : null,
      })
      .eq('id', config.id)

    console.log()
    console.log(`  Results:`)
    console.log(`    Fetched:  ${result.recordsFetched}`)
    console.log(`    Written:  ${result.recordsWritten}`)
    console.log(`    Skipped:  ${result.recordsSkipped}`)
    console.log(`    Duration: ${result.durationMs}ms`)
    console.log(`    Errors:   ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log(`\n  Errors:`)
      for (const err of result.errors.slice(0, 10)) {
        console.log(`    [${err.code}] ${err.message}`)
      }
      if (result.errors.length > 10) {
        console.log(`    ... and ${result.errors.length - 10} more`)
      }
    }

    console.log(`\n  ${result.success ? '✅' : '⚠️'} Sync ${result.success ? 'completed' : 'completed with errors'}`)

    // Post-sync: match Bexio payments to liquidity event instances
    if (connectorType === 'bexio') {
      console.log(`\n  → Running Bexio payment matcher...`)
      try {
        const matchResult = await matchBexioPayments(db, COMPANY_ID)
        console.log(`    Payments processed: ${matchResult.totalPayments}`)
        console.log(`    Matched:            ${matchResult.matchedCount}`)
        console.log(`    Skipped:            ${matchResult.skippedCount}`)
        if (matchResult.matchedCount > 0) {
          console.log(`\n    Matches:`)
          for (const m of matchResult.matches) {
            console.log(`      → Event ${m.eventInstanceId}: confidence ${(m.confidence * 100).toFixed(0)}%, amount Δ ${m.amountDelta.toFixed(2)}, date Δ ${m.dateDeltaDays} days`)
          }
        }
        console.log(`  ✅ Matcher completed`)
      } catch (err) {
        console.error(`  ⚠️ Matcher failed:`, err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    console.error(`\n  ❌ Sync failed:`, err instanceof Error ? err.message : err)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const arg = process.argv[2] ?? 'all'
  const types = arg === 'all'
    ? ['reonic', 'leadnotes', 'bexio', '3cx']
    : [arg]

  console.log(`\nEnura Connector Sync Runner`)
  console.log(`Company: ${COMPANY_ID}`)
  console.log(`Connectors: ${types.join(', ')}`)

  for (const type of types) {
    await runSync(type)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Done.`)
  console.log(`${'='.repeat(60)}\n`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
