import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'

const RUN_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  submitted: 'Eingereicht',
  under_review: 'In Pruefung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  exported: 'Exportiert',
  confirmed_paid: 'Bezahlt',
}

const RUN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  exported: 'bg-blue-100 text-blue-700',
  confirmed_paid: 'bg-gray-100 text-gray-500',
}

interface PaymentRunRow {
  id: string
  run_date: string
  name: string | null
  total_amount: number
  item_count: number
  currency: string
  status: string
  submitted_at: string | null
  approved_at: string | null
  created_at: string
}

export default async function GenehmigungPage() {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Kein Zugriff.</p>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  // Fetch all payment runs
  const { data: runs } = await supabase
    .from('payment_runs')
    .select('id, run_date, name, total_amount, item_count, currency, status, submitted_at, approved_at, created_at')
    .eq('company_id', session!.companyId ?? '')
    .order('created_at', { ascending: false })
    .limit(50)

  const rows = (runs ?? []) as PaymentRunRow[]
  const pendingCount = rows.filter(r => ['submitted', 'under_review'].includes(r.status)).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Genehmigungen</h1>
        <Link href="/finanzplanung" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zurueck
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Zahlungslaeufe pruefen und freigeben.
        {pendingCount > 0 && (
          <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {pendingCount} ausstehend
          </span>
        )}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
          <p className="text-sm text-gray-500">Keine Zahlungslaeufe vorhanden.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Zahlungslauf</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Datum</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Betrag</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Positionen</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Eingereicht</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link href={`/finanzplanung/planung/${run.id}`} className="text-blue-600 hover:underline">
                      {run.name ?? `Zahlungslauf ${run.run_date}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(run.run_date).toLocaleDateString('de-CH')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                    {run.currency} {Number(run.total_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{run.item_count}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RUN_STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {RUN_STATUS_LABELS[run.status] ?? run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {run.submitted_at ? new Date(run.submitted_at).toLocaleDateString('de-CH') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
