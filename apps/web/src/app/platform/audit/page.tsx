import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AuditLogPage() {
  const session = await getSession()
  if (!session?.isEnuraAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">Zugriff verweigert</div>
    )
  }

  let auditEntries: Array<Record<string, unknown>> = []

  try {
    const supabase = createSupabaseServerClient()
    const { data } = await supabase
      .from('audit_log')
      .select('id, company_id, actor_id, action, table_name, record_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    auditEntries = (data ?? []) as Array<Record<string, unknown>>
  } catch {
    // Silently handle
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Audit-Log</h1>
      <p className="text-sm text-gray-500 mb-6">
        Plattformweites Protokoll aller sicherheitsrelevanten Aktionen.
      </p>

      {auditEntries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">Keine Audit-Eintraege vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Zeitpunkt</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Aktion</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tabelle</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Datensatz</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Akteur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {auditEntries.map((entry, i) => (
                <tr key={String(entry['id'] ?? i)}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {entry['created_at'] ? new Date(String(entry['created_at'])).toLocaleString('de-CH') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {String(entry['action'] ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {String(entry['table_name'] ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-[200px]">
                    {String(entry['record_id'] ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-[200px]">
                    {String(entry['actor_id'] ?? '—')}
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
