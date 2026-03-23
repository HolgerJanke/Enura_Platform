import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/audit'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { targetUserId, reason } = (await request.json()) as {
    targetUserId: string
    reason: string
  }
  if (!targetUserId || !reason) {
    return NextResponse.json(
      { error: 'targetUserId and reason required' },
      { status: 400 },
    )
  }

  const db = createSupabaseServiceClient()

  // Verify target user exists
  const { data: targetUser, error: targetError } = await db
    .from('profiles')
    .select('id, tenant_id, display_name')
    .eq('id', targetUserId)
    .single()

  if (targetError || !targetUser) {
    return NextResponse.json(
      { error: 'Zielbenutzer nicht gefunden' },
      { status: 404 },
    )
  }

  // Create impersonation session (30 min expiry)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  const { data: imp, error } = await db
    .from('impersonation_sessions')
    .insert({
      admin_id: session.profile.id,
      target_user_id: targetUserId,
      reason,
      expires_at: expiresAt.toISOString(),
    })
    .select('token')
    .single()

  if (error || !imp) {
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 },
    )
  }

  await writeAuditLog({
    tenantId: (targetUser as Record<string, unknown>)['tenant_id'] as string | null,
    actorId: session.profile.id,
    action: 'admin.impersonation_created',
    recordId: targetUserId,
    newValues: { reason, expiresIn: '30 minutes' },
  })

  return NextResponse.json({
    data: {
      token: (imp as Record<string, unknown>)['token'],
      expiresAt: expiresAt.toISOString(),
    },
  })
}
