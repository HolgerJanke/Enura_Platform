import type { ThreeCXRecording, ThreeCXUser } from './schemas.js'

// ---------------------------------------------------------------------------
// Direction mapping: 3CX CallType -> DB call_direction enum
// ---------------------------------------------------------------------------

function mapDirection(callType: string): string {
  if (callType === 'InboundExternal') return 'inbound'
  return 'outbound'
}

// ---------------------------------------------------------------------------
// Normalise functions
// ---------------------------------------------------------------------------

export function normaliseRecording(
  rec: ThreeCXRecording,
  companyId: string,
  extensionMemberMap: Map<string, string>,
): Record<string, unknown> {
  const ext = rec.FromDn ?? rec.ToDn ?? null
  const teamMemberId = ext
    ? extensionMemberMap.get(ext) ?? null
    : null

  const startMs = new Date(rec.StartTime).getTime()
  const endMs = rec.EndTime ? new Date(rec.EndTime).getTime() : startMs
  const durationSeconds = Math.round((endMs - startMs) / 1000)

  const isInbound = rec.CallType === 'InboundExternal'

  return {
    company_id: companyId,
    external_id: `3cx-rec-${rec.Id}`,
    team_member_id: teamMemberId,
    direction: mapDirection(rec.CallType),
    status: 'answered',
    caller_number: isInbound ? rec.FromCallerNumber : rec.FromCallerNumber ?? null,
    callee_number: rec.ToCallerNumber ?? null,
    duration_seconds: durationSeconds,
    started_at: rec.StartTime,
    ended_at: rec.EndTime ?? null,
    created_at: rec.StartTime,
  }
}

export function normaliseExtension(
  user: ThreeCXUser,
  companyId: string,
): Record<string, unknown> {
  return {
    company_id: companyId,
    external_id: `3cx-ext-${user.Id}`,
    first_name: user.FirstName,
    last_name: user.LastName,
    email: user.EmailAddress ?? null,
    phone: user.Number,
    role_type: 'setter',
    is_active: true,
    updated_at: new Date().toISOString(),
  }
}
