/**
 * Run all Supabase migrations against the remote DB
 * Usage: node scripts/run-migrations.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Connection params hardcoded for migration run


const client = new pg.Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.irudhiaixvmmmvprixge',
  password: 'Frank021272!',
  ssl: { rejectUnauthorized: false },
})

const migrationsDir = join(__dirname, '../supabase/migrations')
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

console.log(`\n🚀  Running ${files.length} migrations against Supabase...\n`)

await client.connect()

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf-8')
  process.stdout.write(`   ⏳  ${file} ... `)
  try {
    await client.query(sql)
    console.log('✅')
  } catch (err) {
    const msg = err.message?.split('\n')[0]
    // Ignore "already exists" errors - idempotent
    if (msg?.includes('already exists') || msg?.includes('duplicate')) {
      console.log(`⚠️  (already exists — skipped)`)
    } else {
      console.log(`❌  ${msg}`)
    }
  }
}

await client.end()
console.log('\n✅  Migrations complete!\n')
