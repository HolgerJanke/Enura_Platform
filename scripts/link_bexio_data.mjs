/**
 * link_bexio_data.mjs
 *
 * Links Bexio invoices to projects and payment schedules in the Enura platform.
 *
 * Strategy:
 *   For each payment_schedule_sales entry with status 'invoiced' or 'paid',
 *   find a Bexio invoice whose total_chf matches the planned_amount (±1 CHF).
 *   If exactly one invoice matches, link them by:
 *     - Setting payment_schedule_sales.invoice_id  = invoice.id
 *     - Setting payment_schedule_sales.invoiced_amount = invoice.total_chf
 *     - Setting invoices.project_id = payment_schedule_sales.project_id
 *
 * Usage:  node scripts/link_bexio_data.mjs [--dry-run]
 */

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co/rest/v1';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydWRoaWFpeHZtbW12cHJpeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTUzNiwiZXhwIjoyMDkyNTg1NTM2fQ.TuDlXr5Gmf6k3w9Z1_GqLkX1bcoFtlBjvdnFeRgc8sM';
const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const TOLERANCE_CHF = 1.0;
const DRY_RUN = process.argv.includes('--dry-run');

// ── helpers ──────────────────────────────────────────────────────────────────

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function supabaseGet(table, query = '') {
  const url = `${SUPABASE_URL}/${table}?${query}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${table} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function supabasePatch(table, id, body) {
  const url = `${SUPABASE_URL}/${table}?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${table}/${id} failed (${res.status}): ${text}`);
  }
}

function amountsMatch(a, b) {
  return Math.abs(a - b) <= TOLERANCE_CHF;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Enura: Link Bexio Invoices to Projects & Payment Schedules ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log();

  // 1. Load payment schedule entries that need linking (status = invoiced or paid)
  console.log('Loading payment_schedule_sales (status in invoiced, paid) ...');
  const schedules = await supabaseGet(
    'payment_schedule_sales',
    `select=id,project_id,contract_id,milestone_name,planned_amount,status,invoice_id` +
      `&company_id=eq.${COMPANY_ID}` +
      `&status=in.(invoiced,paid)` +
      `&invoice_id=is.null` +
      `&order=project_id,position`
  );
  console.log(`  Found ${schedules.length} schedule entries to link.\n`);

  if (schedules.length === 0) {
    console.log('Nothing to do — all linkable entries already have invoice_id set.');
    return;
  }

  // 2. Load all Bexio invoices (project_id IS NULL → unlinked)
  //    Fetch in pages of 500 to handle the full 507-row table.
  console.log('Loading Bexio invoices ...');
  let invoices = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    const page = await supabaseGet(
      'invoices',
      `select=id,external_id,invoice_number,customer_name,amount_chf,total_chf,status,project_id` +
        `&company_id=eq.${COMPANY_ID}` +
        `&order=id` +
        `&offset=${offset}&limit=${PAGE}`
    );
    invoices = invoices.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`  Loaded ${invoices.length} invoices total.`);

  const unlinkedInvoices = invoices.filter((i) => i.project_id === null);
  console.log(`  ${unlinkedInvoices.length} invoices have project_id = NULL (candidates).\n`);

  // 3. For each schedule entry, find matching invoice by amount
  //    Try total_chf first, then amount_chf as fallback
  const results = [];
  const usedInvoiceIds = new Set();

  for (const sched of schedules) {
    const target = sched.planned_amount;

    // Primary: match on total_chf
    let matches = unlinkedInvoices.filter(
      (inv) => amountsMatch(inv.total_chf, target) && !usedInvoiceIds.has(inv.id)
    );
    let matchField = 'total_chf';

    // Fallback: match on amount_chf (net amount) if no total_chf match
    if (matches.length === 0) {
      matches = unlinkedInvoices.filter(
        (inv) => amountsMatch(inv.amount_chf, target) && !usedInvoiceIds.has(inv.id)
      );
      matchField = 'amount_chf';
    }

    const entry = {
      schedule_id: sched.id,
      project_id: sched.project_id,
      milestone: sched.milestone_name,
      planned_amount: target,
      status: sched.status,
      matched: false,
      invoice: null,
      reason: '',
    };

    if (matches.length === 0) {
      entry.reason = 'No invoice found with matching amount';
      console.log(
        `  [SKIP] ${sched.milestone_name} (${target.toFixed(2)} CHF) — no matching invoice`
      );
    } else if (matches.length > 1) {
      entry.reason = `Ambiguous: ${matches.length} invoices match ${matchField}`;
      console.log(
        `  [SKIP] ${sched.milestone_name} (${target.toFixed(2)} CHF) — ${matches.length} invoices match on ${matchField} (ambiguous)`
      );
      for (const m of matches) {
        console.log(
          `         candidate: ${m.invoice_number} total=${m.total_chf} amount=${m.amount_chf} customer="${m.customer_name}"`
        );
      }
    } else {
      const inv = matches[0];
      const matchedAmount = matchField === 'total_chf' ? inv.total_chf : inv.amount_chf;
      entry.matched = true;
      entry.invoice = {
        id: inv.id,
        invoice_number: inv.invoice_number,
        total_chf: inv.total_chf,
        amount_chf: inv.amount_chf,
        customer_name: inv.customer_name,
        external_id: inv.external_id,
        matchField,
      };

      usedInvoiceIds.add(inv.id);

      const diff = Math.abs(matchedAmount - target);
      const diffNote = diff > 0 ? ` (diff: ${diff.toFixed(2)} CHF)` : ' (exact)';

      console.log(
        `  [MATCH] ${sched.milestone_name} ${target.toFixed(2)} CHF` +
          ` → ${inv.invoice_number} (${matchField}=${matchedAmount.toFixed(2)} CHF)${diffNote}` +
          ` → project ${sched.project_id}`
      );
    }

    results.push(entry);
  }

  console.log();

  // 4. Apply updates
  const matched = results.filter((r) => r.matched);
  if (matched.length === 0) {
    console.log('No matches found. Nothing to update.');
    return;
  }

  console.log(`Applying ${matched.length} updates ...`);

  for (const r of matched) {
    const inv = r.invoice;

    if (DRY_RUN) {
      console.log(`  [DRY] Would update payment_schedule_sales ${r.schedule_id}:`);
      console.log(`        invoice_id = ${inv.id}`);
      console.log(`        invoiced_amount = ${inv.total_chf}`);
      console.log(`  [DRY] Would update invoices ${inv.id}:`);
      console.log(`        project_id = ${r.project_id}`);
    } else {
      // Update payment_schedule_sales
      await supabasePatch('payment_schedule_sales', r.schedule_id, {
        invoice_id: inv.id,
        invoiced_amount: inv.total_chf,
      });
      console.log(
        `  Updated payment_schedule_sales ${r.milestone}: invoice_id=${inv.id}, invoiced_amount=${inv.total_chf}`
      );

      // Update invoice with project_id
      await supabasePatch('invoices', inv.id, {
        project_id: r.project_id,
      });
      console.log(`  Updated invoice ${inv.invoice_number}: project_id=${r.project_id}`);
    }
  }

  // 5. Summary
  console.log('\n=== Summary ===');
  console.log(`Total schedule entries checked:  ${schedules.length}`);
  console.log(`Matched & linked:               ${matched.length}`);
  console.log(`Skipped (no match):             ${results.filter((r) => !r.matched && r.reason.startsWith('No')).length}`);
  console.log(`Skipped (ambiguous):            ${results.filter((r) => !r.matched && r.reason.startsWith('Ambiguous')).length}`);
  console.log();

  if (matched.length > 0) {
    console.log('Linked records:');
    console.log('─'.repeat(100));
    console.log(
      'Milestone'.padEnd(20) +
        'Amount (CHF)'.padEnd(15) +
        'Invoice'.padEnd(15) +
        'Inv. Total'.padEnd(15) +
        'Project ID'
    );
    console.log('─'.repeat(100));
    for (const r of matched) {
      console.log(
        r.milestone.padEnd(20) +
          r.planned_amount.toFixed(2).padEnd(15) +
          r.invoice.invoice_number.padEnd(15) +
          r.invoice.total_chf.toFixed(2).padEnd(15) +
          r.project_id
      );
    }
    console.log('─'.repeat(100));
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
