import type {
  CompanyRow,
  CompanyInsert,
  CompanyUpdate,
  CompanyBrandingRow,
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

export interface CompaniesRepository {
  findAll(): Promise<CompanyRow[]>
  findAllActive(): Promise<CompanyRow[]>
  findBySlug(slug: string): Promise<CompanyRow | null>
  findById(id: string): Promise<CompanyRow | null>
  create(data: CompanyInsert): Promise<CompanyRow>
  update(id: string, data: CompanyUpdate): Promise<CompanyRow>
}

/** @deprecated Use CompaniesRepository */
export type TenantsRepository = CompaniesRepository

export interface BrandingsRepository {
  findByCompanyId(companyId: string): Promise<CompanyBrandingRow | null>
}

export interface ProfilesRepository {
  findById(id: string): Promise<ProfileRow | null>
  findByCompanyId(companyId: string): Promise<ProfileRow[]>
  findByEmail(email: string): Promise<ProfileRow | null>
  create(data: ProfileInsert): Promise<ProfileRow>
  update(id: string, data: ProfileUpdate): Promise<ProfileRow>
}

export interface RolesRepository {
  findByProfileId(profileId: string): Promise<RoleRow[]>
  findByCompanyId(companyId: string): Promise<RoleRow[]>
  getPermissions(roleId: string): Promise<string[]>
}

export interface LeadsRepository {
  findMany(companyId: string, opts?: { status?: string; setterId?: string }): Promise<LeadRow[]>
  findById(companyId: string, id: string): Promise<LeadRow | null>
  create(companyId: string, data: LeadInsert): Promise<LeadRow>
  update(companyId: string, id: string, data: LeadUpdate): Promise<LeadRow>
}

export interface OffersRepository {
  findMany(companyId: string, opts?: { status?: string; beraterId?: string }): Promise<OfferRow[]>
  findById(companyId: string, id: string): Promise<OfferRow | null>
  create(companyId: string, data: OfferInsert): Promise<OfferRow>
  update(companyId: string, id: string, data: OfferUpdate): Promise<OfferRow>
}

export interface CallsRepository {
  findMany(companyId: string, opts?: { teamMemberId?: string; status?: string }): Promise<CallRow[]>
  findById(companyId: string, id: string): Promise<CallRow | null>
  getAnalysis(companyId: string, callId: string): Promise<CallAnalysisRow | null>
}

export interface ProjectsRepository {
  findMany(companyId: string, opts?: { phaseId?: string; status?: string }): Promise<ProjectRow[]>
  findById(companyId: string, id: string): Promise<ProjectRow | null>
  create(companyId: string, data: ProjectInsert): Promise<ProjectRow>
  update(companyId: string, id: string, data: ProjectUpdate): Promise<ProjectRow>
}

export interface InvoicesRepository {
  findMany(companyId: string, opts?: { status?: string }): Promise<InvoiceRow[]>
  findById(companyId: string, id: string): Promise<InvoiceRow | null>
  create(companyId: string, data: InvoiceInsert): Promise<InvoiceRow>
  update(companyId: string, id: string, data: InvoiceUpdate): Promise<InvoiceRow>
}

export interface KpiRepository {
  findLatest(companyId: string, snapshotType: string, entityId?: string): Promise<KpiSnapshotRow | null>
}

export interface TeamMembersRepository {
  findByCompanyId(companyId: string): Promise<TeamMemberRow[]>
  findById(companyId: string, id: string): Promise<TeamMemberRow | null>
}

export interface ConnectorsRepository {
  findByCompanyId(companyId: string): Promise<ConnectorRow[]>
}

export interface PhaseDefinitionsRepository {
  findByCompanyId(companyId: string): Promise<PhaseDefinitionRow[]>
}

export interface DataAccess {
  companies: CompaniesRepository
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
