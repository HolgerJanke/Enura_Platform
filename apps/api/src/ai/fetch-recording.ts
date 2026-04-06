import { createClient } from '@supabase/supabase-js'

/**
 * Downloads a call recording from Supabase Storage and returns it as a Buffer.
 *
 * Uses the service role key to bypass RLS on storage — this is acceptable because
 * this function is only called from background workers that have already verified
 * the tenant context.
 *
 * @param storagePath  Path within the "call-recordings" bucket (e.g. "tenant-abc/2026-03-22/call-123.mp3").
 * @returns            Buffer containing the audio bytes, or null if the download failed.
 */
export async function fetchRecordingBuffer(storagePath: string): Promise<Buffer | null> {
  const db = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data, error } = await db.storage
    .from('call-recordings')
    .download(storagePath)

  if (error || !data) {
    console.error('[fetch-recording] Failed:', error?.message)
    return null
  }

  return Buffer.from(await data.arrayBuffer())
}
