import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * DF-11: Bexio doesn't push payment webhooks — we have to poll.
 *
 * This cron walks all not-yet-paid invoices in our DB, queries Bexio for
 * their current status + payment list, and updates our `invoices` and
 * `payments` tables accordingly. Triggers a ripple update on
 * `tenant_daily_summary` snapshots so liquidity dashboards stay fresh.
 *
 * Schedule (configured in vercel.json): once daily on Hobby plan.
 * On Pro plan, can crank to every 30 minutes.
 */

interface InvoiceRow {
  id: string
  company_id: string
  external_id: string
  status: string | null
}

interface BexioInvoice {
  id: number
  kb_item_status_id: number
  total_gross: string
  updated_at: string
}

interface BexioPayment {
  id: number
  value: string
  date: string
  title: string | null
}

const BEXIO_API_BASE = 'https://api.bexio.com/2.0'
const BEXIO_STATUS_MAP: Record<number, string> = {
  7: 'draft',
  8: 'sent',
  9: 'paid',
  16: 'partially_paid',
  19: 'overdue',
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const summary: Array<Record<string, unknown>> = []

  // For each company with an active Bexio connector, poll open invoices
  const { data: connectors } = await db
    .from('connectors')
    .select('company_id, credentials')
    .eq('type', 'bexio')
    .eq('status', 'active')

  for (const conn of (connectors ?? []) as Array<Record<string, unknown>>) {
    const companyId = conn['company_id'] as string
    const creds = conn['credentials'] as Record<string, unknown>
    const accessToken = creds['access_token'] as string

    if (!accessToken) continue

    // Get all invoices for this company that aren't paid yet
    const { data: invoices } = await db
      .from('invoices')
      .select('id, company_id, external_id, status')
      .eq('company_id', companyId)
      .neq('status', 'paid')

    let invoicesChecked = 0
    let invoicesUpdated = 0
    let paymentsWritten = 0

    for (const inv of (invoices ?? []) as InvoiceRow[]) {
      invoicesChecked++
      try {
        // Fetch current invoice state from Bexio
        const invRes = await fetch(`${BEXIO_API_BASE}/kb_invoice/${inv.external_id}`, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        })
        if (!invRes.ok) continue
        const bexioInvoice = (await invRes.json()) as BexioInvoice

        const newStatus = BEXIO_STATUS_MAP[bexioInvoice.kb_item_status_id] ?? 'unknown'

        // Update if status changed
        if (newStatus !== inv.status) {
          await db
            .from('invoices')
            .update({
              status: newStatus,
              total_gross: parseFloat(bexioInvoice.total_gross),
              updated_at: bexioInvoice.updated_at,
            })
            .eq('id', inv.id)
          invoicesUpdated++
        }

        // If invoice has payment activity (paid / partially_paid), fetch and upsert payments
        if (newStatus === 'paid' || newStatus === 'partially_paid') {
          const payRes = await fetch(
            `${BEXIO_API_BASE}/kb_invoice/${inv.external_id}/payment`,
            { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
          )
          if (payRes.ok) {
            const payments = (await payRes.json()) as BexioPayment[]
            for (const p of payments) {
              const { error: upErr } = await db.from('payments').upsert({
                company_id: companyId,
                invoice_id: inv.id,
                external_id: String(p.id),
                amount: parseFloat(p.value),
                payment_date: p.date,
                description: p.title ?? '',
              }, { onConflict: 'company_id,external_id' })
              if (!upErr) paymentsWritten++
            }
          }
        }

        // Tiny delay to be polite with Bexio rate limit
        await new Promise((r) => setTimeout(r, 200))
      } catch {
        // skip and continue
      }
    }

    summary.push({
      company_id: companyId,
      invoices_checked: invoicesChecked,
      invoices_updated: invoicesUpdated,
      payments_written: paymentsWritten,
    })
  }

  return NextResponse.json({ success: true, summary })
}
