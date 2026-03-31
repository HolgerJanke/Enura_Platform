import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SecretsClient } from './secrets-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecretRow {
  id: string
  holding_id: string
  name: string
  secret_type: string
  scope: string
  description: string | null
  is_active: boolean
  created_at: string
  last_rotated_at: string | null
  rotation_interval_days: number | null
  next_rotation_due: string | null
}

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export default async function SecretsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) redirect('/login')

  const holdingId = session.holdingId
  if (!holdingId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Kein Holding zugewiesen. Bitte kontaktieren Sie den Support.</p>
        </div>
      </div>
    )
  }

  const supabase = createSupabaseServerClient()

  const { data: secrets, error } = await supabase
    .from('holding_secrets')
    .select('id, holding_id, name, secret_type, scope, description, is_active, created_at, last_rotated_at, rotation_interval_days, next_rotation_due')
    .eq('holding_id', holdingId)
    .order('name')

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-900 mb-1">Fehler beim Laden</h2>
          <p className="text-sm text-red-700">
            Die Secrets konnten nicht geladen werden. Bitte versuchen Sie es erneut.
          </p>
        </div>
      </div>
    )
  }

  const secretRows: SecretRow[] = ((secrets ?? []) as Record<string, unknown>[]).map((s) => ({
    id: s['id'] as string,
    holding_id: s['holding_id'] as string,
    name: s['name'] as string,
    secret_type: s['secret_type'] as string,
    scope: s['scope'] as string,
    description: (s['description'] as string | null) ?? null,
    is_active: s['is_active'] as boolean,
    created_at: s['created_at'] as string,
    last_rotated_at: (s['last_rotated_at'] as string | null) ?? null,
    rotation_interval_days: (s['rotation_interval_days'] as number | null) ?? null,
    next_rotation_due: (s['next_rotation_due'] as string | null) ?? null,
  }))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Secret-Verwaltung</h1>
          <p className="text-gray-500 mt-1">
            Verwalten Sie API-Schluessel, OAuth-Tokens und Zertifikate fuer Ihre Holding
          </p>
        </div>
        <Link
          href="/admin/secrets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Secret
        </Link>
      </div>

      <SecretsClient secrets={secretRows} />
    </div>
  )
}
