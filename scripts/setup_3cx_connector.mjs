#!/usr/bin/env node
/**
 * Sets up the 3CX connector in the connectors table.
 * Usage: node scripts/setup_3cx_connector.mjs
 */
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co'
const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const HOLDING_ID = '00000000-0000-0000-0000-000000000010'

const envContent = readFileSync('apps/web/.env.local', 'utf8')
const SERVICE_KEY = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const connector = {
  company_id: COMPANY_ID,
  type: '3cx',
  name: '3CX Cloud — Alpen Energie',
  status: 'active',
  credentials: {
    apiUrl: 'https://user167429.3cx.ch',
    username: 's.vogel@alpen-energie.ch',
    password: 'Frank021272!',
  },
  config: {
    syncInterval: 'hourly',
    recordingsEnabled: true,
  },
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/connectors`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify(connector),
})

if (!res.ok) {
  const text = await res.text()
  if (text.includes('duplicate') || text.includes('unique')) {
    console.log('Connector already exists, updating...')
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/connectors?company_id=eq.${COMPANY_ID}&type=eq.3cx`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          credentials: connector.credentials,
          config: connector.config,
          status: 'active',
          name: connector.name,
        }),
      },
    )
    if (!patchRes.ok) {
      console.error('PATCH failed:', patchRes.status, await patchRes.text())
      process.exit(1)
    }
    const updated = await patchRes.json()
    console.log('Updated:', updated[0]?.id)
  } else {
    console.error('POST failed:', res.status, text)
    process.exit(1)
  }
} else {
  const data = await res.json()
  console.log('Created connector:', data[0]?.id)
}

console.log('Done.')
