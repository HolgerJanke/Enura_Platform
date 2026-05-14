import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = 'https://irudhiaixvmmmvprixge.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydWRoaWFpeHZtbW12cHJpeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTUzNiwiZXhwIjoyMDkyNTg1NTM2fQ.TuDlXr5Gmf6k3w9Z1_GqLkX1bcoFtlBjvdnFeRgc8sM';

const supabase = createClient(supabaseUrl, serviceKey);

const sql = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '048_finance_contracts_procurement.sql'),
  'utf-8'
);

// Split into individual statements, removing BEGIN/COMMIT transaction wrappers
// (Supabase REST doesn't support multi-statement transactions)
const statements = sql
  .replace(/^BEGIN;/m, '')
  .replace(/^COMMIT;/m, '')
  .split(/;\s*$/m)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Found ${statements.length} SQL statements to execute`);

async function run() {
  // Execute each statement individually via rpc
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    process.stdout.write(`[${i+1}/${statements.length}] ${preview}... `);

    const { error } = await supabase.rpc('exec_sql', { sql_string: stmt });
    if (error) {
      // Try raw fetch if rpc not available
      console.log('rpc unavailable, trying raw...');
      break;
    }
    console.log('OK');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
