import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ToolEditClient } from './tool-edit-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolDetail {
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

export default async function ToolEditPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

  const holdingId = session.holdingId
  if (!holdingId) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

  const supabase = createSupabaseServerClient()

  // Fetch tool
  const { data: tool, error: toolError } = await supabase
    .from('tool_registry')
    .select('id, holding_id, name, slug, category, base_url, auth_type, secret_ref, is_active, icon_url, docs_url, created_at, updated_at')
    .eq('id', params.id)
    .eq('holding_id', holdingId)
    .single()

  if (toolError || !tool) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurueck</a></div>)
  }

  const toolRecord = tool as Record<string, unknown>
  const toolDetail: ToolDetail = {
    id: toolRecord['id'] as string,
    holding_id: toolRecord['holding_id'] as string,
    name: toolRecord['name'] as string,
    slug: toolRecord['slug'] as string,
    category: toolRecord['category'] as string,
    base_url: (toolRecord['base_url'] as string | null) ?? null,
    auth_type: toolRecord['auth_type'] as string,
    secret_ref: (toolRecord['secret_ref'] as string | null) ?? null,
    is_active: toolRecord['is_active'] as boolean,
    icon_url: (toolRecord['icon_url'] as string | null) ?? null,
    docs_url: (toolRecord['docs_url'] as string | null) ?? null,
    created_at: toolRecord['created_at'] as string,
    updated_at: toolRecord['updated_at'] as string,
  }

  // Fetch available secrets for dropdown
  const { data: secrets } = await supabase
    .from('holding_secrets')
    .select('name')
    .eq('holding_id', holdingId)
    .eq('is_active', true)
    .order('name')

  const secretNames: string[] = ((secrets ?? []) as Record<string, unknown>[]).map(
    (s) => s['name'] as string,
  )

  return (
    <div className="p-6 max-w-2xl">
      <ToolEditClient tool={toolDetail} availableSecrets={secretNames} />
    </div>
  )
}
