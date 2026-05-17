import type {
  CompanyRow,
  CompanyBrandingRow,
  ProfileRow,
  RoleRow,
  LeadRow,
  TeamMemberRow,
  OfferRow,
  ProjectRow,
  PhaseDefinitionRow,
  CallRow,
  CallAnalysisRow,
  InvoiceRow,
} from './database.js'

export type CompanyWithBranding = CompanyRow & {
  branding: CompanyBrandingRow
}

/** @deprecated Use CompanyWithBranding */
export type TenantWithBranding = CompanyWithBranding

export type UserSession = {
  profile: ProfileRow
  holdingId: string | null
  companyId: string | null
  roles: RoleRow[]
  permissions: string[]
  isEnuraAdmin: boolean
  isHoldingAdmin: boolean
}

export type ProjectWithPhase = ProjectRow & {
  phase: PhaseDefinitionRow
  berater: TeamMemberRow | null
}

export type LeadWithSetter = LeadRow & {
  setter: TeamMemberRow | null
}

export type OfferWithBerater = OfferRow & {
  berater: TeamMemberRow | null
  lead: LeadRow | null
}

export type CallWithAnalysis = CallRow & {
  analysis: CallAnalysisRow | null
  teamMember: TeamMemberRow | null
}

export type InvoiceWithOffer = InvoiceRow & {
  offer: OfferRow | null
}

export type NavigationItem = {
  key: string
  label: string
  href: string
  icon: string
  requiredPermission: string | null
}

export type NavigationSection = {
  key: string
  title: string
  items: NavigationItem[]
}

/**
 * Platform navigation structure — "Prozesshaus" (Process House).
 * Items are shown/hidden based on the user's permissions.
 */
export const navigationSections: NavigationSection[] = [
  {
    key: 'processes',
    title: 'PROZESSE',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'dashboard', requiredPermission: null },
      { key: 'leads', label: 'Leads & Vertrieb', href: '/leads', icon: 'sales', requiredPermission: 'module:leads:read' },
      { key: 'projects', label: 'Projekte', href: '/projects', icon: 'project', requiredPermission: 'module:bau:read' },
      { key: 'processes', label: 'Prozesse', href: '/processes', icon: 'montage', requiredPermission: 'module:bau:read' },
    ],
  },
  {
    key: 'automation',
    title: 'AUTOMATION',
    items: [
      { key: 'bots', label: 'Bots', href: '/bots', icon: 'bot', requiredPermission: 'module:bots:read' },
      { key: 'routes', label: 'Routen', href: '/routes', icon: 'route', requiredPermission: 'module:bots:read' },
    ],
  },
  {
    key: 'support',
    title: 'SUPPORT',
    items: [
      { key: 'analytics', label: 'Analytics', href: '/analytics', icon: 'analytics', requiredPermission: 'module:reports:read' },
      { key: 'controlling', label: 'Finanzen & Controlling', href: '/controlling', icon: 'finance', requiredPermission: 'module:finance:read' },
    ],
  },
]

/** Flat list of all navigation items (for lookups) */
export const navigationItems: NavigationItem[] = navigationSections.flatMap((s) => s.items)

/** Settings nav item — shown separately for admins */
export const settingsNavItem: NavigationItem = {
  key: 'settings',
  label: 'Einstellungen',
  href: '/settings/connectors',
  icon: 'settings',
  requiredPermission: 'module:admin:read',
}
