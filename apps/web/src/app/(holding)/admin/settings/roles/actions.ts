'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleWithPermissions {
  id: string
  key: string
  label: string
  description: string | null
  isSystem: boolean
  permissionIds: string[]
}

export interface PermissionItem {
  id: string
  key: string
  label: string
  description: string | null
  group: string
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const session = await getSession()
  if (!session) throw new Error('Nicht authentifiziert')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) {
    throw new Error('Keine Berechtigung')
  }
  return session
}

// ---------------------------------------------------------------------------
// Fetch roles with their permission assignments
// ---------------------------------------------------------------------------

export async function getRolesWithPermissions(
  companyId: string,
): Promise<{ roles: RoleWithPermissions[]; permissions: PermissionItem[] }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  // Fetch all roles for this company
  const { data: roles } = await supabase
    .from('roles')
    .select('id, key, label, description, is_system')
    .eq('company_id', companyId)
    .order('is_system', { ascending: false })
    .order('label')

  // Fetch all permissions
  const { data: permissions } = await supabase
    .from('permissions')
    .select('id, key, label, description')
    .order('key')

  // Fetch role_permissions for all roles in this company
  const roleIds = (roles ?? []).map((r) => (r as Record<string, unknown>)['id'] as string)
  const { data: rolePerms } = roleIds.length > 0
    ? await supabase
        .from('role_permissions')
        .select('role_id, permission_id')
        .in('role_id', roleIds)
    : { data: [] }

  // Build role → permission map
  const permMap = new Map<string, string[]>()
  for (const rp of (rolePerms ?? []) as Array<{ role_id: string; permission_id: string }>) {
    const arr = permMap.get(rp.role_id) ?? []
    arr.push(rp.permission_id)
    permMap.set(rp.role_id, arr)
  }

  const rolesWithPerms: RoleWithPermissions[] = (roles ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: row['id'] as string,
      key: row['key'] as string,
      label: row['label'] as string,
      description: row['description'] as string | null,
      isSystem: row['is_system'] as boolean,
      permissionIds: permMap.get(row['id'] as string) ?? [],
    }
  })

  // Group permissions by module prefix
  const permItems: PermissionItem[] = (permissions ?? []).map((p) => {
    const row = p as Record<string, unknown>
    const key = row['key'] as string
    const parts = key.split(':')
    const group = parts.length >= 2 ? parts[1]! : 'other'
    return {
      id: row['id'] as string,
      key,
      label: row['label'] as string,
      description: row['description'] as string | null,
      group,
    }
  })

  return { roles: rolesWithPerms, permissions: permItems }
}

// ---------------------------------------------------------------------------
// Create custom role
// ---------------------------------------------------------------------------

export async function createCustomRole(
  companyId: string,
  key: string,
  label: string,
  description: string,
  permissionIds: string[],
): Promise<{ success: boolean; error?: string; roleId?: string }> {
  const session = await requireAdmin()
  const supabase = createSupabaseServerClient()

  // Get holding_id for this company
  const { data: company } = await supabase
    .from('companies')
    .select('holding_id')
    .eq('id', companyId)
    .single()

  if (!company) return { success: false, error: 'Unternehmen nicht gefunden.' }

  const holdingId = (company as Record<string, unknown>)['holding_id'] as string

  // Create role
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .insert({
      company_id: companyId,
      holding_id: holdingId,
      key: key.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      label,
      description: description || null,
      is_system: false,
    })
    .select('id')
    .single()

  if (roleError) return { success: false, error: roleError.message }
  const roleId = (role as { id: string }).id

  // Assign permissions
  if (permissionIds.length > 0) {
    await supabase
      .from('role_permissions')
      .upsert(
        permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid })),
        { onConflict: 'role_id,permission_id' },
      )
  }

  revalidatePath('/admin/settings/roles')
  return { success: true, roleId }
}

// ---------------------------------------------------------------------------
// Update role permissions (diff-based)
// ---------------------------------------------------------------------------

export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  // Get current permissions
  const { data: current } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId)

  const currentIds = new Set(
    ((current ?? []) as Array<{ permission_id: string }>).map((r) => r.permission_id),
  )
  const newIds = new Set(permissionIds)

  const toAdd = permissionIds.filter((id) => !currentIds.has(id))
  const toRemove = [...currentIds].filter((id) => !newIds.has(id))

  if (toAdd.length > 0) {
    await supabase
      .from('role_permissions')
      .upsert(
        toAdd.map((pid) => ({ role_id: roleId, permission_id: pid })),
        { onConflict: 'role_id,permission_id' },
      )
  }

  for (const pid of toRemove) {
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', pid)
  }

  revalidatePath('/admin/settings/roles')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Delete custom role
// ---------------------------------------------------------------------------

export async function deleteCustomRole(
  roleId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  // Verify it's not a system role
  const { data: role } = await supabase
    .from('roles')
    .select('is_system, key')
    .eq('id', roleId)
    .single()

  if (!role) return { success: false, error: 'Rolle nicht gefunden.' }
  if ((role as Record<string, unknown>)['is_system']) {
    return { success: false, error: 'Systemrollen koennen nicht geloescht werden.' }
  }

  // Delete role_permissions first, then role (cascade should handle but be explicit)
  await supabase.from('role_permissions').delete().eq('role_id', roleId)
  await supabase.from('profile_roles').delete().eq('role_id', roleId)

  const { error } = await supabase.from('roles').delete().eq('id', roleId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/settings/roles')
  return { success: true }
}
