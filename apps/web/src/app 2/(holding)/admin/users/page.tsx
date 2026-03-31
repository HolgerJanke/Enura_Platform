import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@enura/types'

type HoldingAdminWithProfile = {
  id: string
  profile_id: string
  created_at: string
  profiles: ProfileRow | null
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HoldingUsersPage() {
  const supabase = createSupabaseServerClient()

  // Fetch holding admins with their profile data
  const { data: holdingAdmins, error } = await supabase
    .from('holding_admins')
    .select(`
      id,
      profile_id,
      created_at,
      profiles (*)
    `)
    .order('created_at', { ascending: false })

  const admins = (holdingAdmins ?? []) as unknown as HoldingAdminWithProfile[]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Holding-Benutzer</h1>
          <p className="text-gray-500 mt-1">
            Administratoren mit Zugriff auf die Holding-Verwaltung
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Fehler beim Laden der Benutzerdaten. Bitte versuchen Sie es erneut.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                E-Mail
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Erstellt am
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Letzter Login
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  Keine Holding-Administratoren gefunden.
                </td>
              </tr>
            ) : (
              admins.map((admin) => {
                const profile = admin.profiles
                const firstName = profile?.first_name ?? ''
                const lastName = profile?.last_name ?? ''
                const displayName = profile?.display_name ?? 'Unbekannt'
                const isActive = profile?.is_active ?? false
                const initials = [firstName, lastName]
                  .filter(Boolean)
                  .map((n) => n.charAt(0).toUpperCase())
                  .join('')

                return (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                          {initials || 'HA'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {firstName && lastName ? `${firstName} ${lastName}` : displayName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {displayName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {isActive ? 'Aktiv' : 'Deaktiviert'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(admin.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {profile?.last_sign_in_at
                        ? formatDate(profile.last_sign_in_at)
                        : 'Noch nie'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="text-sm font-medium text-blue-900 mb-1">Hinweis</h2>
        <p className="text-sm text-blue-700">
          Holding-Administratoren haben Zugriff auf alle Unternehmen und koennen
          Mandanten-Super-User fuer Supportzwecke imitieren. Alle Aktionen werden
          im Audit-Log protokolliert.
        </p>
      </div>
    </div>
  )
}
