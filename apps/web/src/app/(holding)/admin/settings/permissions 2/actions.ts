'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'

// ---------------------------------------------------------------------------
// Platform-locked permissions that cannot be changed by holding admins.
// These are enforced at the platform level and are always ON.
// ---------------------------------------------------------------------------

const PLATFORM_LOCKS: ReadonlySet<string> = new Set([
  'audit_log.read',
  'audit_log.export',
  'data_residency.enforce',
  'totp.require',
  'rls.enforce',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireHoldingSession() {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin) throw new Error('Kein Zugriff')
  if (!session.holdingId) {
    throw new Error('Kein Holding zugewiesen.')
  }
  return { session, holdingId: session.holdingId, userId: session.profile.id }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionMatrixEntry = {
  key: string
  label: string
  category: string
  description: string
  enabled: boolean
  platformLocked: boolean
}

// ---------------------------------------------------------------------------
// Default permission definitions grouped by category
// ---------------------------------------------------------------------------

const PERMISSION_DEFINITIONS: ReadonlyArray<{
  key: string
  label: string
  category: string
  description: string
}> = [
  // Prozesse
  { key: 'process.create', label: 'Prozesse erstellen', category: 'Prozesse', description: 'Neue Geschaeftsprozesse definieren und konfigurieren' },
  { key: 'process.deploy', label: 'Prozesse deployen', category: 'Prozesse', description: 'Prozesse in Produktionsumgebung bereitstellen' },
  { key: 'process.delete', label: 'Prozesse loeschen', category: 'Prozesse', description: 'Bestehende Prozesse unwiderruflich entfernen' },
  { key: 'process.version', label: 'Prozess-Versionierung', category: 'Prozesse', description: 'Versionsverwaltung fuer Prozesse aktivieren' },
  { key: 'connector.manage', label: 'Konnektoren verwalten', category: 'Prozesse', description: 'Externe Integrationen erstellen und konfigurieren' },
  { key: 'connector.credentials', label: 'Zugangsdaten verwalten', category: 'Prozesse', description: 'API-Schluessel und OAuth-Tokens fuer Konnektoren bearbeiten' },

  // Benutzer
  { key: 'user.invite', label: 'Benutzer einladen', category: 'Benutzer', description: 'Neue Benutzer per E-Mail zur Plattform einladen' },
  { key: 'user.deactivate', label: 'Benutzer deaktivieren', category: 'Benutzer', description: 'Benutzerzugang sperren ohne Datenverlust' },
  { key: 'user.role_assign', label: 'Rollen zuweisen', category: 'Benutzer', description: 'Benutzerrollen und Berechtigungen aendern' },
  { key: 'user.2fa_reset', label: '2FA zuruecksetzen', category: 'Benutzer', description: 'Zwei-Faktor-Authentifizierung fuer Benutzer zuruecksetzen' },
  { key: 'user.impersonate', label: 'Benutzer imitieren', category: 'Benutzer', description: 'Als anderer Benutzer agieren (wird im Audit-Log protokolliert)' },

  // Daten
  { key: 'data.export', label: 'Daten exportieren', category: 'Daten', description: 'Unternehmensdaten als CSV/Excel exportieren' },
  { key: 'data.delete', label: 'Daten loeschen', category: 'Daten', description: 'Datensaetze unwiderruflich entfernen' },
  { key: 'data.bulk_import', label: 'Massenimport', category: 'Daten', description: 'Grosse Datenmengen per Upload importieren' },
  { key: 'audit_log.read', label: 'Audit-Log einsehen', category: 'Daten', description: 'Protokoll aller Systemaktivitaeten einsehen (Plattform-Pflicht)' },
  { key: 'audit_log.export', label: 'Audit-Log exportieren', category: 'Daten', description: 'Audit-Protokoll als Datei exportieren (Plattform-Pflicht)' },
  { key: 'data_residency.enforce', label: 'Datenresidenz erzwingen', category: 'Daten', description: 'EU/CH-Datenresidenz sicherstellen (Plattform-Pflicht)' },
  { key: 'totp.require', label: '2FA-Pflicht', category: 'Daten', description: 'Zwei-Faktor-Authentifizierung fuer alle Benutzer erzwingen (Plattform-Pflicht)' },
  { key: 'rls.enforce', label: 'Row-Level-Security', category: 'Daten', description: 'Mandantentrennung auf Datenbankebene (Plattform-Pflicht)' },
]

// ---------------------------------------------------------------------------
// getPermissionMatrix — build the matrix from current holding config
// ---------------------------------------------------------------------------

export async function getPermissionMatrix(): Promise<PermissionMatrixEntry[]> {
  const { holdingId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { data: holding } = await supabase
    .from('holdings')
    .select('permission_matrix')
    .eq('id', holdingId)
    .single()

  const currentMatrix = (holding?.permission_matrix ?? {}) as Record<string, boolean>

  return PERMISSION_DEFINITIONS.map((def) => {
    const isPlatformLocked = PLATFORM_LOCKS.has(def.key)
    return {
      key: def.key,
      label: def.label,
      category: def.category,
      description: def.description,
      enabled: isPlatformLocked ? true : (currentMatrix[def.key] ?? true),
      platformLocked: isPlatformLocked,
    }
  })
}

// ---------------------------------------------------------------------------
// savePermissionMatrix — persist the matrix, enforcing platform locks
// ---------------------------------------------------------------------------

export async function savePermissionMatrix(
  matrix: Record<string, boolean>,
): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Enforce platform locks -- they must always be true
  const sanitized: Record<string, boolean> = {}
  for (const def of PERMISSION_DEFINITIONS) {
    if (PLATFORM_LOCKS.has(def.key)) {
      sanitized[def.key] = true
    } else {
      sanitized[def.key] = matrix[def.key] ?? true
    }
  }

  // Fetch old matrix for audit diff
  const { data: holdingBefore } = await supabase
    .from('holdings')
    .select('permission_matrix')
    .eq('id', holdingId)
    .single()

  const { error } = await supabase
    .from('holdings')
    .update({ permission_matrix: sanitized })
    .eq('id', holdingId)

  if (error) {
    return { success: false, error: `Fehler beim Speichern: ${error.message}` }
  }

  await writeAuditLog({
    companyId: null,
    actorId: userId,
    action: 'holding.permission_matrix.updated',
    tableName: 'holdings',
    recordId: holdingId,
    oldValues: holdingBefore?.permission_matrix as Record<string, unknown> | undefined,
    newValues: sanitized,
  })

  revalidatePath('/admin/settings/permissions')
  return { success: true }
}
