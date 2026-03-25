import type { ThreeCXCall, ThreeCXExtension } from './schemas.js'

// ---------------------------------------------------------------------------
// Direction mapping: 3CX values -> DB enum
// ---------------------------------------------------------------------------

const DIRECTION_MAP: Record<string, string> = {
  inbound: 'inbound',
  outbound: 'outbound',
}

function mapDirection(raw: string): string {
  return DIRECTION_MAP[raw.toLowerCase()] ?? 'inbound'
}

// ---------------------------------------------------------------------------
// Call result mapping: 3CX values -> DB call_status enum
// ---------------------------------------------------------------------------

const RESULT_MAP: Record<string, string> = {
  answered: 'answered',
  missed: 'missed',
  noanswer: 'missed',
  notanswered: 'missed',
  voicemail: 'voicemail',
  busy: 'busy',
  failed: 'failed',
}

function mapCallResult(raw: string): string {
  return RESULT_MAP[raw.toLowerCase()] ?? 'missed'
}

// ---------------------------------------------------------------------------
// Normalise functions
// ---------------------------------------------------------------------------

export function normaliseCall(
  call: ThreeCXCall,
  tenantId: string,
  extensionMemberMap: Map<string, string>,
): Record<string, unknown> {
  const teamMemberId = call.extension
    ? extensionMemberMap.get(call.extension) ?? null
    : null

  return {
    tenant_id: tenantId,
    external_id: call.id,
    team_member_id: teamMemberId,
    direction: mapDirection(call.direction),
    status: mapCallResult(call.result),
    caller_number: call.caller_number ?? null,
    callee_number: call.callee_number ?? null,
    duration_seconds: call.duration,
    started_at: call.start_time,
    ended_at: call.end_time ?? null,
    created_at: call.start_time,
  }
}

export function normaliseExtension(
  ext: ThreeCXExtension,
  tenantId: string,
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    external_id: `3cx-ext-${ext.id}`,
    first_name: ext.first_name,
    last_name: ext.last_name,
    email: ext.email ?? null,
    phone: ext.number,
    role_type: 'setter',
    is_active: true,
    updated_at: new Date().toISOString(),
  }
}
