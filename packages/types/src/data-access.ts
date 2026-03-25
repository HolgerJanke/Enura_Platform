import type {
  TenantRow,
  TenantInsert,
  TenantUpdate,
  TenantBrandingRow,
  ProfileRow,
  ProfileInsert,
  ProfileUpdate,
  RoleRow,
  LeadRow,
  LeadInsert,
  LeadUpdate,
  OfferRow,
  OfferInsert,
  OfferUpdate,
  CallRow,
  CallAnalysisRow,
  ProjectRow,
  ProjectInsert,
  ProjectUpdate,
  InvoiceRow,
  InvoiceInsert,
  InvoiceUpdate,
  KpiSnapshotRow,
  TeamMemberRow,
  ConnectorRow,
  PhaseDefinitionRow,
} from './database.js'

export interface TenantsRepository {
  findAll(): Promise<TenantRow[]>
  findBySlug(slug: string): Promise<TenantRow | null>
  findById(id: string): Promise<TenantRow | null>
  create(data: TenantInsert): Promise<TenantRow>
  update(id: string, data: TenantUpdate): Promise<TenantRow>
}

export interface BrandingsRepository {
  findByTenantId(tenantId: string): Promise<TenantBrandingRow | null>
}

export interface ProfilesRepository {
  findById(id: string): Promise<ProfileRow | null>
  findByTenantId(tenantId: string): Promise<ProfileRow[]>
  findByEmail(email: string): Promise<ProfileRow | null>
  create(data: ProfileInsert): Promise<ProfileRow>
  update(id: string, data: ProfileUpdate): Promise<ProfileRow>
}

export interface RolesRepository {
  findByProfileId(profileId: string): Promise<RoleRow[]>
  findByTenantId(tenantId: string): Promise<RoleRow[]>
  getPermissions(roleId: string): Promise<string[]>
}

export interface LeadsRepository {
  findMany(tenantId: string, opts?: { status?: string; setterId?: string }): Promise<LeadRow[]>
  findById(tenantId: string, id: string): Promise<LeadRow | null>
  create(tenantId: string, data: LeadInsert): Promise<LeadRow>
  update(tenantId: string, id: string, data: LeadUpdate): Promise<LeadRow>
}

export interface OffersRepository {
  findMany(tenantId: string, opts?: { status?: string; beraterId?: string }): Promise<OfferRow[]>
  findById(tenantId: string, id: string): Promise<OfferRow | null>
  create(tenantId: string, data: OfferInsert): Promise<OfferRow>
  update(tenantId: string, id: string, data: OfferUpdate): Promise<OfferRow>
}

export interface CallsRepository {
  findMany(tenantId: string, opts?: { teamMemberId?: string; status?: string }): Promise<CallRow[]>
  findById(tenantId: string, id: string): Promise<CallRow | null>
  getAnalysis(tenantId: string, callId: string): Promise<CallAnalysisRow | null>
}

export interface ProjectsRepository {
  findMany(tenantId: string, opts?: { phaseId?: string; status?: string }): Promise<ProjectRow[]>
  findById(tenantId: string, id: string): Promise<ProjectRow | null>
  create(tenantId: string, data: ProjectInsert): Promise<ProjectRow>
  update(tenantId: string, id: string, data: ProjectUpdate): Promise<ProjectRow>
}

export interface InvoicesRepository {
  findMany(tenantId: string, opts?: { status?: string }): Promise<InvoiceRow[]>
  findById(tenantId: string, id: string): Promise<InvoiceRow | null>
  create(tenantId: string, data: InvoiceInsert): Promise<InvoiceRow>
  update(tenantId: string, id: string, data: InvoiceUpdate): Promise<InvoiceRow>
}

export interface KpiRepository {
  findLatest(tenantId: string, snapshotType: string, entityId?: string): Promise<KpiSnapshotRow | null>
}

export interface TeamMembersRepository {
  findByTenantId(tenantId: string): Promise<TeamMemberRow[]>
  findById(tenantId: string, id: string): Promise<TeamMemberRow | null>
}

export interface ConnectorsRepository {
  findByTenantId(tenantId: string): Promise<ConnectorRow[]>
}

export interface PhaseDefinitionsRepository {
  findByTenantId(tenantId: string): Promise<PhaseDefinitionRow[]>
}

export interface DataAccess {
  tenants: TenantsRepository
  brandings: BrandingsRepository
  profiles: ProfilesRepository
  roles: RolesRepository
  leads: LeadsRepository
  offers: OffersRepository
  calls: CallsRepository
  projects: ProjectsRepository
  invoices: InvoicesRepository
  kpis: KpiRepository
  teamMembers: TeamMembersRepository
  connectors: ConnectorsRepository
  phaseDefinitions: PhaseDefinitionsRepository
}
