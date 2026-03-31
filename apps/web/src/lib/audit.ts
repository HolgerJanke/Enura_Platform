import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function writeAuditLog(entry: {
  companyId: string | null
  actorId: string
  action: string
  tableName?: string
  recordId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient()
    await supabase.from('audit_log').insert({
      company_id: entry.companyId,
      actor_id: entry.actorId,
      action: entry.action,
      table_name: entry.tableName ?? null,
      record_id: entry.recordId ?? null,
      old_values: entry.oldValues ?? null,
      new_values: entry.newValues ?? null,
      ip_address: entry.ipAddress ?? null,
    })
  } catch (err) {
    // Never throw on audit log failure -- log and continue
    console.error('[audit] Failed to write audit log:', err)
  }
}
