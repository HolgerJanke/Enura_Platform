import { createClient } from '@supabase/supabase-js'
import type { SyncError } from './base.js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function upsertRecords(
  table: string,
  records: Record<string, unknown>[],
  conflictKeys: string[],
  opts?: { chunkSize?: number },
): Promise<{ written: number; errors: SyncError[] }> {
  const db = getServiceClient()
  const chunkSize = opts?.chunkSize ?? 100
  let written = 0
  const errors: SyncError[] = []

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)

    const { error, count } = await db
      .from(table)
      .upsert(chunk, {
        onConflict: conflictKeys.join(','),
        ignoreDuplicates: false,
        count: 'exact',
      })

    if (error) {
      errors.push({
        code: error.code ?? 'UPSERT_ERROR',
        message: error.message,
        context: { table, chunkIndex: Math.floor(i / chunkSize) },
      })
    } else {
      written += count ?? chunk.length
    }
  }

  return { written, errors }
}
