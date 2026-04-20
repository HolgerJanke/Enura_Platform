export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SecretDetailClient } from './secret-detail-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecretDetail {
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
  vault_id: string | null
}

interface AccessLogEntry {
  id: number
  secret_id: string
  accessed_by: string
  context: string | null
  accessed_at: string
}

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export default async function SecretDetailPage({
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

  // Fetch secret
  const { data: secret, error: secretError } = await supabase
    .from('holding_secrets')
    .select('id, holding_id, name, secret_type, scope, description, is_active, created_at, last_rotated_at, rotation_interval_days, next_rotation_due, vault_id')
    .eq('id', params.id)
    .eq('holding_id', holdingId)
    .single()

  if (secretError || !secret) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurück</a></div>)
  }

  const secretRecord = secret as Record<string, unknown>
  const secretDetail: SecretDetail = {
    id: secretRecord['id'] as string,
    holding_id: secretRecord['holding_id'] as string,
    name: secretRecord['name'] as string,
    secret_type: secretRecord['secret_type'] as string,
    scope: secretRecord['scope'] as string,
    description: (secretRecord['description'] as string | null) ?? null,
    is_active: secretRecord['is_active'] as boolean,
    created_at: secretRecord['created_at'] as string,
    last_rotated_at: (secretRecord['last_rotated_at'] as string | null) ?? null,
    rotation_interval_days: (secretRecord['rotation_interval_days'] as number | null) ?? null,
    next_rotation_due: (secretRecord['next_rotation_due'] as string | null) ?? null,
    vault_id: (secretRecord['vault_id'] as string | null) ?? null,
  }

  // Fetch last 20 access log entries
  const { data: accessLogs } = await supabase
    .from('secret_access_log')
    .select('id, secret_id, accessed_by, context, accessed_at')
    .eq('secret_id', params.id)
    .eq('holding_id', holdingId)
    .order('accessed_at', { ascending: false })
    .limit(20)

  const logEntries: AccessLogEntry[] = ((accessLogs ?? []) as Record<string, unknown>[]).map((l) => ({
    id: l['id'] as number,
    secret_id: l['secret_id'] as string,
    accessed_by: l['accessed_by'] as string,
    context: (l['context'] as string | null) ?? null,
    accessed_at: l['accessed_at'] as string,
  }))

  return (
    <div className="p-6 max-w-4xl">
      <SecretDetailClient secret={secretDetail} accessLogs={logEntries} />
    </div>
  )
}
