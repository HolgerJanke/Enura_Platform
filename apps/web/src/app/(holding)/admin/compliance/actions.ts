'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireHoldingSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) redirect('/login')
  if (!session.holdingId) {
    throw new Error('Kein Holding zugewiesen.')
  }
  return { session, holdingId: session.holdingId, userId: session.profile.id }
}

// ---------------------------------------------------------------------------
// fulfillCheck — mark a compliance check as fulfilled
// ---------------------------------------------------------------------------

export async function fulfillCheck(checkId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('compliance_checks')
    .update({
      status: 'fulfilled' as const,
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: userId,
      notes: notes ?? null,
    })
    .eq('id', checkId)
    .eq('holding_id', holdingId)

  if (error) {
    return { success: false, error: `Fehler beim Erfuellen: ${error.message}` }
  }

  revalidatePath('/admin/compliance')
  return { success: true }
}

// ---------------------------------------------------------------------------
// waiveCheck — waive a compliance check with reason and optional expiry
// ---------------------------------------------------------------------------

export async function waiveCheck(
  checkId: string,
  reason: string,
  expiresAt?: string,
): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  if (!reason.trim()) {
    return { success: false, error: 'Eine Begruendung ist erforderlich.' }
  }

  const { error } = await supabase
    .from('compliance_checks')
    .update({
      status: 'waived' as const,
      waived_by: userId,
      waive_reason: reason,
      waive_expires_at: expiresAt ?? null,
    })
    .eq('id', checkId)
    .eq('holding_id', holdingId)

  if (error) {
    return { success: false, error: `Fehler beim Zurueckstellen: ${error.message}` }
  }

  revalidatePath('/admin/compliance')
  return { success: true }
}

// ---------------------------------------------------------------------------
// uploadDocument — insert compliance document metadata
// ---------------------------------------------------------------------------

export async function uploadDocument(formData: FormData): Promise<{ success: boolean; error?: string; id?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const title = formData.get('title') as string | null
  const documentType = formData.get('document_type') as string | null
  const companyId = formData.get('company_id') as string | null
  const checkId = formData.get('check_id') as string | null
  const validFrom = formData.get('valid_from') as string | null
  const expiresAt = formData.get('expires_at') as string | null
  const file = formData.get('file') as File | null

  if (!title || !documentType || !file) {
    return { success: false, error: 'Titel, Dokumenttyp und Datei sind erforderlich.' }
  }

  // Upload file to Supabase Storage
  const storagePath = `compliance/${holdingId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('compliance-documents')
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) {
    return { success: false, error: `Upload fehlgeschlagen: ${uploadError.message}` }
  }

  // Insert document metadata
  const { data, error } = await supabase
    .from('compliance_documents')
    .insert({
      holding_id: holdingId,
      company_id: companyId || null,
      check_id: checkId || null,
      document_type: documentType,
      title,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      valid_from: validFrom || null,
      expires_at: expiresAt || null,
      uploaded_by: userId,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: `Fehler beim Speichern: ${error.message}` }
  }

  revalidatePath('/admin/compliance')
  return { success: true, id: (data as Record<string, unknown>)['id'] as string }
}

// ---------------------------------------------------------------------------
// getDocumentUrl — generate a signed URL for downloading a document
// ---------------------------------------------------------------------------

export async function getDocumentUrl(storagePath: string): Promise<{ url?: string; error?: string }> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase.storage
    .from('compliance-documents')
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error || !data) {
    return { error: `Download-URL konnte nicht erstellt werden: ${error?.message ?? 'Unbekannter Fehler'}` }
  }

  return { url: data.signedUrl }
}

// ---------------------------------------------------------------------------
// updateCertification — update certification status and metadata
// ---------------------------------------------------------------------------

export async function updateCertification(
  certId: string,
  updates: {
    status?: string
    certifiedAt?: string | null
    expiresAt?: string | null
    documentId?: string | null
    notes?: string | null
  },
): Promise<{ success: boolean; error?: string }> {
  const { holdingId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.status !== undefined) updatePayload['status'] = updates.status
  if (updates.certifiedAt !== undefined) updatePayload['certified_at'] = updates.certifiedAt
  if (updates.expiresAt !== undefined) updatePayload['expires_at'] = updates.expiresAt
  if (updates.documentId !== undefined) updatePayload['document_id'] = updates.documentId
  if (updates.notes !== undefined) updatePayload['notes'] = updates.notes

  const { error } = await supabase
    .from('certifications')
    .update(updatePayload)
    .eq('id', certId)
    .eq('holding_id', holdingId)

  if (error) {
    return { success: false, error: `Fehler beim Aktualisieren: ${error.message}` }
  }

  revalidatePath('/admin/compliance')
  revalidatePath('/admin/compliance/certifications')
  return { success: true }
}
