export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ToolsClient } from './tools-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolRow {
  id: string
  holding_id: string
  name: string
  slug: string
  category: string
  base_url: string | null
  auth_type: string
  secret_ref: string | null
  is_active: boolean
  icon_url: string | null
  docs_url: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export default async function ToolsPage() {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

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

  const { data: tools, error } = await supabase
    .from('tool_registry')
    .select('id, holding_id, name, slug, category, base_url, auth_type, secret_ref, is_active, icon_url, docs_url, created_at, updated_at')
    .eq('holding_id', holdingId)
    .order('name')

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-900 mb-1">Fehler beim Laden</h2>
          <p className="text-sm text-red-700">
            Die Tool-Registry konnte nicht geladen werden. Bitte versuchen Sie es erneut.
          </p>
        </div>
      </div>
    )
  }

  const toolRows: ToolRow[] = ((tools ?? []) as Record<string, unknown>[]).map((t) => ({
    id: t['id'] as string,
    holding_id: t['holding_id'] as string,
    name: t['name'] as string,
    slug: t['slug'] as string,
    category: t['category'] as string,
    base_url: (t['base_url'] as string | null) ?? null,
    auth_type: t['auth_type'] as string,
    secret_ref: (t['secret_ref'] as string | null) ?? null,
    is_active: t['is_active'] as boolean,
    icon_url: (t['icon_url'] as string | null) ?? null,
    docs_url: (t['docs_url'] as string | null) ?? null,
    created_at: t['created_at'] as string,
    updated_at: t['updated_at'] as string,
  }))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tool-Registry</h1>
          <p className="text-gray-500 mt-1">
            Verwalten Sie externe Tools und Integrationen für Ihre Holding
          </p>
        </div>
        <Link
          href="/admin/tools/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Tool
        </Link>
      </div>

      <ToolsClient tools={toolRows} />
    </div>
  )
}
