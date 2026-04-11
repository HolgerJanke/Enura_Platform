'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadProjectDocument(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.companyId) return { success: false, error: 'Nicht authentifiziert.' }

  const projectId = formData.get('projectId') as string
  const documentType = formData.get('documentType') as string
  const title = formData.get('title') as string
  const file = formData.get('file') as File | null

  if (!projectId || !documentType || !title || !file) {
    return { success: false, error: 'Alle Felder sind erforderlich.' }
  }

  // Validate file size (max 20MB)
  if (file.size > 20 * 1024 * 1024) {
    return { success: false, error: 'Datei darf maximal 20 MB groß sein.' }
  }

  const supabase = createSupabaseServerClient()

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${session.holdingId}/${session.companyId}/${projectId}/${Date.now()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    // Bucket might not exist — try creating it
    if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
      return { success: false, error: `Storage-Fehler: ${uploadError.message}. Bitte Storage-Bucket "project-documents" in Supabase erstellen.` }
    }
    return { success: false, error: `Upload fehlgeschlagen: ${uploadError.message}` }
  }

  // Insert document record
  const { error: insertError } = await supabase
    .from('project_documents')
    .insert({
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      project_id: projectId,
      document_type: documentType,
      title,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: session.profile.id,
    })

  if (insertError) {
    return { success: false, error: `Datensatz-Fehler: ${insertError.message}` }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function deleteProjectDocument(
  documentId: string,
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }

  const supabase = createSupabaseServerClient()

  // Get storage path before deleting record
  const { data: doc } = await supabase
    .from('project_documents')
    .select('storage_path')
    .eq('id', documentId)
    .single()

  if (doc) {
    await supabase.storage
      .from('project-documents')
      .remove([(doc as Record<string, unknown>)['storage_path'] as string])
  }

  const { error } = await supabase
    .from('project_documents')
    .delete()
    .eq('id', documentId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
