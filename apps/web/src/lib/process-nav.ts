import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UserSession } from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MainProcessKey = 'vertrieb' | 'planung' | 'abwicklung' | 'service' | 'sonstige'

export interface ProcessNavItem {
  id: string
  name: string
  menuLabel: string
  menuIcon: string
  href: string
  menuSortOrder: number
}

export interface MainProcessGroup {
  key: MainProcessKey
  label: string
  icon: string
  processes: ProcessNavItem[]
}

// ---------------------------------------------------------------------------
// Main process metadata
// ---------------------------------------------------------------------------

const MAIN_PROCESS_META: Record<MainProcessKey, { label: string; icon: string; sortOrder: number }> = {
  vertrieb: { label: 'Vertrieb', icon: 'TrendingUp', sortOrder: 1 },
  planung: { label: 'Planung', icon: 'CalendarDays', sortOrder: 2 },
  abwicklung: { label: 'Abwicklung', icon: 'ClipboardCheck', sortOrder: 3 },
  service: { label: 'Service', icon: 'Wrench', sortOrder: 4 },
  sonstige: { label: 'Sonstige', icon: 'MoreHorizontal', sortOrder: 5 },
}

// ---------------------------------------------------------------------------
// Dominant main_process resolver
// ---------------------------------------------------------------------------

interface StepMainProcessRow {
  process_id: string
  main_process: string | null
}

function resolveDominantProcess(
  processId: string,
  stepRows: StepMainProcessRow[],
): MainProcessKey {
  const stepsForProcess = stepRows.filter((s) => s.process_id === processId)
  if (stepsForProcess.length === 0) return 'sonstige'

  const counts: Record<string, number> = {}
  for (const step of stepsForProcess) {
    const mp = step.main_process ?? 'sonstige'
    counts[mp] = (counts[mp] ?? 0) + 1
  }

  let maxKey: MainProcessKey = 'sonstige'
  let maxCount = 0
  for (const [key, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxKey = key as MainProcessKey
    }
  }

  // Validate that the key is a known main process
  if (!(maxKey in MAIN_PROCESS_META)) {
    return 'sonstige'
  }

  return maxKey
}

// ---------------------------------------------------------------------------
// buildProcessNavGroups
// ---------------------------------------------------------------------------

export async function buildProcessNavGroups(
  session: UserSession,
): Promise<MainProcessGroup[]> {
  if (!session.companyId) return []

  const supabase = createSupabaseServerClient()

  // Fetch deployed process definitions for this company
  const { data: deployedProcesses } = await supabase
    .from('process_definitions')
    .select('id, name, menu_label, menu_icon, menu_sort_order, visible_roles')
    .eq('company_id', session.companyId)
    .eq('status', 'deployed')
    .order('menu_sort_order')

  if (!deployedProcesses || deployedProcesses.length === 0) return []

  const processRows = deployedProcesses as Array<Record<string, unknown>>

  // Filter by user roles
  const userRoleKeys = session.roles.map((r) => r.key)
  const visibleProcesses = processRows.filter((p) => {
    if (session.isHoldingAdmin) return true
    const visibleRoles = (p['visible_roles'] as string[]) ?? []
    if (visibleRoles.length === 0) return true
    return visibleRoles.some((vr) => userRoleKeys.includes(vr))
  })

  if (visibleProcesses.length === 0) return []

  // Fetch main_process for all steps of visible processes
  const processIds = visibleProcesses.map((p) => p['id'] as string)
  const { data: stepsData } = await supabase
    .from('process_steps')
    .select('process_id, main_process')
    .in('process_id', processIds)

  const stepRows: StepMainProcessRow[] = ((stepsData ?? []) as Array<Record<string, unknown>>).map(
    (s) => ({
      process_id: s['process_id'] as string,
      main_process: (s['main_process'] as string | null) ?? null,
    }),
  )

  // Build groups
  const groupMap = new Map<MainProcessKey, ProcessNavItem[]>()

  for (const p of visibleProcesses) {
    const processId = p['id'] as string
    const dominantKey = resolveDominantProcess(processId, stepRows)

    const item: ProcessNavItem = {
      id: processId,
      name: p['name'] as string,
      menuLabel: (p['menu_label'] as string | null) ?? (p['name'] as string),
      menuIcon: (p['menu_icon'] as string | null) ?? '',
      href: `/processes/${processId}`,
      menuSortOrder: (p['menu_sort_order'] as number | null) ?? 0,
    }

    const existing = groupMap.get(dominantKey) ?? []
    existing.push(item)
    groupMap.set(dominantKey, existing)
  }

  // Convert to sorted array
  const groups: MainProcessGroup[] = []
  for (const [key, meta] of Object.entries(MAIN_PROCESS_META)) {
    const processes = groupMap.get(key as MainProcessKey)
    if (!processes || processes.length === 0) continue

    processes.sort((a, b) => a.menuSortOrder - b.menuSortOrder)

    groups.push({
      key: key as MainProcessKey,
      label: meta.label,
      icon: meta.icon,
      processes,
    })
  }

  groups.sort(
    (a, b) => MAIN_PROCESS_META[a.key].sortOrder - MAIN_PROCESS_META[b.key].sortOrder,
  )

  return groups
}
