import { createClient } from '@supabase/supabase-js'

const RECORDINGS_BUCKET = 'call-recordings'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Downloads a call recording from an external URL and stores it in
 * Supabase Storage under a tenant-scoped path.
 *
 * Returns the storage path on success, or null on failure.
 */
export async function storeRecording(
  companyId: string,
  callId: string,
  externalUrl: string,
): Promise<string | null> {
  const db = getServiceClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const path = `${companyId}/calls/${year}/${month}/${callId}.mp3`

  const response = await fetch(externalUrl)
  if (!response.ok || !response.body) {
    console.error(
      `[recording-storage] Failed to fetch recording: ${response.status} ${response.statusText}`,
    )
    return null
  }

  const arrayBuffer = await response.arrayBuffer()

  const { error } = await db.storage
    .from(RECORDINGS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (error) {
    console.error('[recording-storage] Upload failed:', error.message)
    return null
  }

  return path
}

/**
 * Generates a time-limited signed URL for accessing a stored recording.
 *
 * @param storagePath - The path returned by storeRecording()
 * @param expiresIn  - Validity in seconds (default: 1 hour)
 */
export async function getRecordingSignedUrl(
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string | null> {
  const db = getServiceClient()

  const { data, error } = await db.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    console.error(
      '[recording-storage] Signed URL generation failed:',
      error.message,
    )
    return null
  }

  return data.signedUrl
}
