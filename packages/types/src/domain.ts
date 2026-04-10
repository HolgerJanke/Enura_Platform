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

export const navigationItems: NavigationItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'home', requiredPermission: null },
  { key: 'setter', label: 'Setter', href: '/setter', icon: 'phone', requiredPermission: 'module:setter:read' },
  { key: 'berater', label: 'Berater', href: '/berater', icon: 'briefcase', requiredPermission: 'module:berater:read' },
  { key: 'leads', label: 'Leads', href: '/leads', icon: 'users', requiredPermission: 'module:leads:read' },
  { key: 'innendienst', label: 'Innendienst', href: '/innendienst', icon: 'clipboard', requiredPermission: 'module:innendienst:read' },
  { key: 'projects', label: 'Projekte', href: '/projects', icon: 'kanban', requiredPermission: 'module:bau:read' },
  { key: 'finance', label: 'Finanzen', href: '/finance', icon: 'wallet', requiredPermission: 'module:finance:read' },
  { key: 'settings', label: 'Einstellungen', href: '/settings/users', icon: 'settings', requiredPermission: 'module:admin:read' },
]
