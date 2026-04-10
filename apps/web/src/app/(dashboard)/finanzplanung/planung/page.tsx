import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasFinanzplanungPermission } from '@/lib/finanzplanung-guard'
import { CashoutCalendar } from './cashout-calendar-client'

interface ApprovedInvoice {
  id: string
  invoice_number: string | null
  sender_name: string | null
  gross_amount: number | null
  currency: string
  due_date: string | null
}

export default async function PlanungPage() {
  const canPlan = await hasFinanzplanungPermission('module:finanzplanung:plan_cashout')
  if (!canPlan) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Keine Berechtigung für die Zahlungsplanung.</p>
        <Link href="/finanzplanung" className="text-blue-600 underline text-sm">Zurück</Link>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  // Fetch approved invoices ready for scheduling
  const { data: approvedInvoices } = await supabase
    .from('invoices_incoming')
    .select('id, invoice_number, sender_name, gross_amount, currency, due_date')
    .eq('company_id', session!.companyId ?? '')
    .eq('status', 'approved')
    .order('due_date', { ascending: true })

  const invoices = (approvedInvoices ?? []) as ApprovedInvoice[]

  // Fetch existing payment runs
  const { data: runs } = await supabase
    .from('payment_runs')
    .select('id, run_date, name, total_amount, item_count, currency, status, created_at')
    .eq('company_id', session!.companyId ?? '')
    .in('status', ['draft', 'submitted', 'under_review', 'approved'])
    .order('run_date', { ascending: true })
    .limit(20)

  const activeRuns = (runs ?? []) as Array<{
    id: string; run_date: string; name: string | null;
    total_amount: number; item_count: number; currency: string; status: string
  }>

  const totalPending = invoices.reduce((sum, inv) => sum + Number(inv.gross_amount ?? 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Zahlungsplanung</h1>
        <Link href="/finanzplanung" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zurück
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Genehmigte Rechnungen terminieren und Zahlungsläufe erstellen.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Genehmigte Rechnungen</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{invoices.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Gesamtbetrag ausstehend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            CHF {totalPending.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Aktive Zahlungsläufe</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeRuns.length}</p>
        </div>
      </div>

      {/* Approved invoices awaiting scheduling */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Genehmigte Rechnungen</h2>
      {invoices.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center mb-8">
          <p className="text-sm text-gray-500">
            Keine genehmigten Rechnungen zur Zahlungsplanung vorhanden.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nr.</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Glaeubiger</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Betrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Fälligkeit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((inv) => {
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date()
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{inv.invoice_number ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{inv.sender_name ?? 'Unbekannt'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                      {inv.currency} {Number(inv.gross_amount ?? 0).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('de-CH') : '—'}
                      {isOverdue && ' (überfällig)'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Active payment runs */}
      {activeRuns.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aktive Zahlungsläufe</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRuns.map((run) => (
              <Link
                key={run.id}
                href={`/finanzplanung/planung/${run.id}`}
                className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {run.name ?? `Zahlungslauf ${run.run_date}`}
                  </h3>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    run.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                    run.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {run.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{run.currency} {Number(run.total_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
                  <span>{run.item_count} Positionen</span>
                  <span>{new Date(run.run_date).toLocaleDateString('de-CH')}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Calendar drag-and-drop view */}
      {invoices.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Kalender-Ansicht</h2>
          <p className="text-sm text-gray-500 mb-4">
            Verschieben Sie Rechnungskarten per Drag-and-Drop in eine andere Datumsspalte, um das Zahlungsdatum zu ändern.
          </p>
          <CashoutCalendar
            invoices={invoices.map(inv => ({
              id: inv.id,
              invoice_number: inv.invoice_number,
              sender_name: inv.sender_name,
              gross_amount: Number(inv.gross_amount ?? 0),
              currency: inv.currency,
              due_date: inv.due_date ?? new Date().toISOString().split('T')[0]!,
              scheduled_date: null,
            }))}
            onScheduleChange={async () => {
              // Server action for schedule change would go here
              // For now this is client-side only
            }}
          />
        </div>
      )}
    </div>
  )
}
