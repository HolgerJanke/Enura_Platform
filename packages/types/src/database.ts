// =============================================================================
// Enura Group Multi-Tenant BI Platform — Database Types
// Generated from supabase/schema.sql
// =============================================================================

// =============================================================================
// ENUMS
// =============================================================================

export type TenantStatus = 'active' | 'suspended' | 'archived';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'appointment_set'
  | 'won'
  | 'lost'
  | 'invalid';

export type LeadSource =
  | 'website'
  | 'referral'
  | 'partner'
  | 'advertising'
  | 'cold_call'
  | 'leadnotes'
  | 'other';

export type OfferStatus =
  | 'draft'
  | 'sent'
  | 'negotiating'
  | 'won'
  | 'lost'
  | 'expired';

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus = 'answered' | 'missed' | 'voicemail' | 'busy' | 'failed';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'partially_paid';

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled';

export type ConnectorType =
  | 'reonic'
  | '3cx'
  | 'bexio'
  | 'google_calendar'
  | 'leadnotes'
  | 'whatsapp'
  | 'gmail';

export type ConnectorStatus = 'active' | 'paused' | 'error' | 'disconnected';

export type SyncStatus = 'running' | 'success' | 'error';

export type CashflowType = 'income' | 'expense';

// =============================================================================
// TABLE: companies (was tenants)
// =============================================================================

export interface CompanyRow {
  id: string;
  holding_id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyInsert {
  id?: string;
  holding_id: string;
  slug: string;
  name: string;
  status?: TenantStatus;
  created_by?: string | null;
}

export interface CompanyUpdate {
  slug?: string;
  name?: string;
  status?: TenantStatus;
  holding_id?: string;
}

/** @deprecated Use CompanyRow */
export type TenantRow = CompanyRow;

// =============================================================================
// TABLE: holdings
// =============================================================================

export interface HoldingRow {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  branding: Record<string, unknown>;
  primary_domain: string | null;
  permission_matrix: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingInsert {
  id?: string;
  name: string;
  slug: string;
  status?: 'active' | 'suspended' | 'archived';
  branding?: Record<string, unknown>;
  primary_domain?: string | null;
  permission_matrix?: Record<string, unknown>;
  created_by?: string | null;
}

export interface HoldingUpdate {
  name?: string;
  slug?: string;
  status?: 'active' | 'suspended' | 'archived';
  branding?: Record<string, unknown>;
  primary_domain?: string | null;
  permission_matrix?: Record<string, unknown>;
}

// =============================================================================
// TABLE: domain_mappings
// =============================================================================

export interface DomainMappingRow {
  id: string;
  domain: string;
  holding_id: string;
  company_id: string | null;
  ssl_status: 'pending' | 'active' | 'error';
  created_at: string;
}

export interface DomainMappingInsert {
  domain: string;
  holding_id: string;
  company_id?: string | null;
  ssl_status?: 'pending' | 'active' | 'error';
}

export interface DomainMappingUpdate {
  domain?: string;
  company_id?: string | null;
  ssl_status?: 'pending' | 'active' | 'error';
}

// =============================================================================
// TABLE: holding_admins_v2
// =============================================================================

export interface HoldingAdminV2Row {
  id: string;
  holding_id: string;
  profile_id: string;
  is_owner: boolean;
  created_at: string;
}

export interface HoldingAdminV2Insert {
  holding_id: string;
  profile_id: string;
  is_owner?: boolean;
}

export interface HoldingAdminV2Update {
  is_owner?: boolean;
}

// =============================================================================
// TABLE: enura_admins
// =============================================================================

export interface EnuraAdminRow {
  id: string;
  profile_id: string;
  created_at: string;
}

export interface EnuraAdminInsert {
  profile_id: string;
}

export interface EnuraAdminUpdate {}

// =============================================================================
// TABLE: enura_platform
// =============================================================================

export interface EnuraPlatformRow {
  id: string;
  name: string;
  default_language: string;
  default_locale: string;
  created_at: string;
}

// =============================================================================
// TABLE: tenant_brandings
// =============================================================================

export interface CompanyBrandingRow {
  id: string;
  company_id: string;
  holding_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_primary: string;
  text_secondary: string;
  font_family: string;
  font_url: string | null;
  border_radius: string;
  logo_url: string | null;
  dark_mode_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyBrandingInsert {
  id?: string;
  company_id: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  surface_color?: string;
  text_primary?: string;
  text_secondary?: string;
  font_family?: string;
  font_url?: string | null;
  border_radius?: string;
  logo_url?: string | null;
  dark_mode_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyBrandingUpdate {
  id?: string;
  company_id?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  surface_color?: string;
  text_primary?: string;
  text_secondary?: string;
  font_family?: string;
  font_url?: string | null;
  border_radius?: string;
  logo_url?: string | null;
  dark_mode_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: profiles
// =============================================================================

export interface ProfileRow {
  id: string;
  company_id: string | null;
  holding_id: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  locale: string;
  must_reset_password: boolean;
  password_reset_at: string | null;
  totp_enabled: boolean;
  totp_enrolled_at: string | null;
  last_sign_in_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  company_id?: string | null;
  holding_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  locale?: string;
  must_reset_password?: boolean;
  password_reset_at?: string | null;
  totp_enabled?: boolean;
  totp_enrolled_at?: string | null;
  last_sign_in_at?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileUpdate {
  id?: string;
  company_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  locale?: string;
  must_reset_password?: boolean;
  password_reset_at?: string | null;
  totp_enabled?: boolean;
  totp_enrolled_at?: string | null;
  last_sign_in_at?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: roles
// =============================================================================

export interface RoleRow {
  id: string;
  company_id: string | null;
  holding_id: string | null;
  key: string;
  label: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleInsert {
  id?: string;
  company_id?: string | null;
  key: string;
  label: string;
  description?: string | null;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RoleUpdate {
  id?: string;
  company_id?: string | null;
  key?: string;
  label?: string;
  description?: string | null;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: permissions
// =============================================================================

export interface PermissionRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  created_at: string;
}

export interface PermissionInsert {
  id?: string;
  key: string;
  label: string;
  description?: string | null;
  created_at?: string;
}

export interface PermissionUpdate {
  id?: string;
  key?: string;
  label?: string;
  description?: string | null;
  created_at?: string;
}

// =============================================================================
// TABLE: role_permissions
// =============================================================================

export interface RolePermissionRow {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface RolePermissionInsert {
  id?: string;
  role_id: string;
  permission_id: string;
  created_at?: string;
}

export interface RolePermissionUpdate {
  id?: string;
  role_id?: string;
  permission_id?: string;
  created_at?: string;
}

// =============================================================================
// TABLE: profile_roles
// =============================================================================

export interface ProfileRoleRow {
  id: string;
  profile_id: string;
  role_id: string;
  created_at: string;
}

export interface ProfileRoleInsert {
  id?: string;
  profile_id: string;
  role_id: string;
  created_at?: string;
}

export interface ProfileRoleUpdate {
  id?: string;
  profile_id?: string;
  role_id?: string;
  created_at?: string;
}

// =============================================================================
// TABLE: team_members
// =============================================================================

export interface TeamMemberRow {
  id: string;
  company_id: string;
  holding_id: string;
  profile_id: string | null;
  external_id: string | null;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role_type: string;
  team: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberInsert {
  id?: string;
  company_id: string;
  profile_id?: string | null;
  external_id?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  role_type: string;
  team?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMemberUpdate {
  id?: string;
  company_id?: string;
  profile_id?: string | null;
  external_id?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  role_type?: string;
  team?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: leads
// =============================================================================

export interface LeadRow {
  id: string;
  company_id: string;
  holding_id: string;
  external_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  address_canton: string | null;
  status: LeadStatus;
  source: LeadSource;
  setter_id: string | null;
  notes: string | null;
  qualified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadInsert {
  id?: string;
  company_id: string;
  external_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_street?: string | null;
  address_zip?: string | null;
  address_city?: string | null;
  address_canton?: string | null;
  status?: LeadStatus;
  source?: LeadSource;
  setter_id?: string | null;
  notes?: string | null;
  qualified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LeadUpdate {
  id?: string;
  company_id?: string;
  external_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_street?: string | null;
  address_zip?: string | null;
  address_city?: string | null;
  address_canton?: string | null;
  status?: LeadStatus;
  source?: LeadSource;
  setter_id?: string | null;
  notes?: string | null;
  qualified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: offers
// =============================================================================

export interface OfferRow {
  id: string;
  company_id: string;
  holding_id: string;
  external_id: string | null;
  lead_id: string | null;
  berater_id: string | null;
  title: string;
  description: string | null;
  amount_chf: string;
  status: OfferStatus;
  sent_at: string | null;
  decided_at: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferInsert {
  id?: string;
  company_id: string;
  external_id?: string | null;
  lead_id?: string | null;
  berater_id?: string | null;
  title: string;
  description?: string | null;
  amount_chf?: string;
  status?: OfferStatus;
  sent_at?: string | null;
  decided_at?: string | null;
  valid_until?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OfferUpdate {
  id?: string;
  company_id?: string;
  external_id?: string | null;
  lead_id?: string | null;
  berater_id?: string | null;
  title?: string;
  description?: string | null;
  amount_chf?: string;
  status?: OfferStatus;
  sent_at?: string | null;
  decided_at?: string | null;
  valid_until?: string | null;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: calls (TimescaleDB hypertable, partition key: started_at)
// =============================================================================

export interface CallRow {
  id: string;
  company_id: string;
  holding_id: string;
  external_id: string | null;
  team_member_id: string | null;
  direction: CallDirection;
  status: CallStatus;
  caller_number: string | null;
  callee_number: string | null;
  duration_seconds: number;
  recording_url: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface CallInsert {
  id?: string;
  company_id: string;
  external_id?: string | null;
  team_member_id?: string | null;
  direction: CallDirection;
  status: CallStatus;
  caller_number?: string | null;
  callee_number?: string | null;
  duration_seconds?: number;
  recording_url?: string | null;
  started_at: string;
  ended_at?: string | null;
  created_at?: string;
}

export interface CallUpdate {
  id?: string;
  company_id?: string;
  external_id?: string | null;
  team_member_id?: string | null;
  direction?: CallDirection;
  status?: CallStatus;
  caller_number?: string | null;
  callee_number?: string | null;
  duration_seconds?: number;
  recording_url?: string | null;
  started_at?: string;
  ended_at?: string | null;
  created_at?: string;
}

// =============================================================================
// TABLE: call_analysis
// =============================================================================

export interface CallAnalysisRow {
  id: string;
  company_id: string;
  holding_id: string;
  call_id: string;
  call_started_at: string;
  transcript: string | null;
  greeting_score: number | null;
  needs_analysis_score: number | null;
  presentation_score: number | null;
  closing_score: number | null;
  overall_score: number | null;
  suggestions: Record<string, unknown> | null;
  script_adherence: string | null;
  model_version: string;
  analyzed_at: string;
  created_at: string;
}

export interface CallAnalysisInsert {
  id?: string;
  company_id: string;
  call_id: string;
  call_started_at: string;
  transcript?: string | null;
  greeting_score?: number | null;
  needs_analysis_score?: number | null;
  presentation_score?: number | null;
  closing_score?: number | null;
  overall_score?: number | null;
  suggestions?: Record<string, unknown> | null;
  script_adherence?: string | null;
  model_version?: string;
  analyzed_at?: string;
  created_at?: string;
}

export interface CallAnalysisUpdate {
  id?: string;
  company_id?: string;
  call_id?: string;
  call_started_at?: string;
  transcript?: string | null;
  greeting_score?: number | null;
  needs_analysis_score?: number | null;
  presentation_score?: number | null;
  closing_score?: number | null;
  overall_score?: number | null;
  suggestions?: Record<string, unknown> | null;
  script_adherence?: string | null;
  model_version?: string;
  analyzed_at?: string;
  created_at?: string;
}

// =============================================================================
// TABLE: invoices
// =============================================================================

export interface InvoiceRow {
  id: string;
  company_id: string;
  holding_id: string;
  external_id: string | null;
  offer_id: string | null;
  invoice_number: string;
  customer_name: string;
  amount_chf: string;
  tax_chf: string;
  total_chf: string;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceInsert {
  id?: string;
  company_id: string;
  external_id?: string | null;
  offer_id?: string | null;
  invoice_number: string;
  customer_name: string;
  amount_chf: string;
  tax_chf?: string;
  total_chf: string;
  status?: InvoiceStatus;
  issued_at: string;
  due_at: string;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceUpdate {
  id?: string;
  company_id?: string;
  external_id?: string | null;
  offer_id?: string | null;
  invoice_number?: string;
  customer_name?: string;
  amount_chf?: string;
  tax_chf?: string;
  total_chf?: string;
  status?: InvoiceStatus;
  issued_at?: string;
  due_at?: string;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: payments
// =============================================================================

export interface PaymentRow {
  id: string;
  company_id: string;
  holding_id: string;
  invoice_id: string;
  amount_chf: string;
  received_at: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface PaymentInsert {
  id?: string;
  company_id: string;
  invoice_id: string;
  amount_chf: string;
  received_at: string;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface PaymentUpdate {
  id?: string;
  company_id?: string;
  invoice_id?: string;
  amount_chf?: string;
  received_at?: string;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string;
}

// =============================================================================
// TABLE: offer_notes
// =============================================================================

export interface OfferNoteRow {
  id: string;
  company_id: string;
  holding_id: string;
  offer_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
}

export interface OfferNoteInsert {
  id?: string;
  company_id: string;
  offer_id: string;
  author_id?: string | null;
  content: string;
  created_at?: string;
}

export interface OfferNoteUpdate {
  id?: string;
  content?: string;
}

// =============================================================================
// TABLE: call_scripts
// =============================================================================

export interface CallScriptRow {
  id: string;
  company_id: string;
  holding_id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallScriptInsert {
  id?: string;
  company_id: string;
  name: string;
  content: string;
  is_active?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CallScriptUpdate {
  id?: string;
  name?: string;
  content?: string;
  is_active?: boolean;
  updated_at?: string;
}

// =============================================================================
// TABLE: cashflow_uploads
// =============================================================================

export interface CashflowUploadRow {
  id: string;
  company_id: string;
  holding_id: string;
  filename: string;
  uploaded_by: string | null;
  row_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface CashflowUploadInsert {
  id?: string;
  company_id: string;
  filename: string;
  uploaded_by?: string | null;
  row_count?: number;
  status?: string;
  error_message?: string | null;
  created_at?: string;
}

export interface CashflowUploadUpdate {
  id?: string;
  row_count?: number;
  status?: string;
  error_message?: string | null;
}

// =============================================================================
// TABLE: project_phase_history
// =============================================================================

export interface ProjectPhaseHistoryRow {
  id: string;
  project_id: string;
  company_id: string;
  holding_id: string;
  from_phase: number | null;
  to_phase: number;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface ProjectPhaseHistoryInsert {
  id?: string;
  project_id: string;
  company_id: string;
  from_phase?: number | null;
  to_phase: number;
  changed_by?: string | null;
  note?: string | null;
  created_at?: string;
}

export interface ProjectPhaseHistoryUpdate {
  id?: string;
  note?: string | null;
}

// =============================================================================
// TABLE: phase_definitions
// =============================================================================

export interface PhaseDefinitionRow {
  id: string;
  company_id: string;
  holding_id: string;
  phase_number: number;
  name: string;
  description: string | null;
  color: string | null;
  stall_threshold_days: number | null;
  created_at: string;
}

export interface PhaseDefinitionInsert {
  id?: string;
  company_id: string;
  phase_number: number;
  name: string;
  description?: string | null;
  color?: string | null;
  stall_threshold_days?: number | null;
  created_at?: string;
}

export interface PhaseDefinitionUpdate {
  id?: string;
  company_id?: string;
  phase_number?: number;
  name?: string;
  description?: string | null;
  color?: string | null;
  stall_threshold_days?: number | null;
  created_at?: string;
}

// =============================================================================
// TABLE: projects
// =============================================================================

export interface ProjectRow {
  id: string;
  company_id: string;
  holding_id: string;
  external_id: string | null;
  lead_id: string | null;
  offer_id: string | null;
  berater_id: string | null;
  title: string;
  customer_name: string;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  phase_id: string | null;
  status: ProjectStatus;
  phase_entered_at: string;
  installation_date: string | null;
  completion_date: string | null;
  description: string | null;
  project_value: number | null;
  system_size_kwp: number | null;
  project_start_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TABLE: project_documents
// =============================================================================

export type ProjectDocumentType = 'voice_note' | 'email' | 'drawing' | 'photo' | 'video' | 'invoice_customer' | 'invoice_supplier' | 'contract' | 'offer' | 'report' | 'other'

export interface ProjectDocumentRow {
  id: string;
  holding_id: string;
  company_id: string;
  project_id: string;
  document_type: ProjectDocumentType;
  title: string;
  description: string | null;
  storage_path: string;
  filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ProjectDocumentInsert {
  holding_id: string;
  company_id: string;
  project_id: string;
  document_type: ProjectDocumentType;
  title: string;
  description?: string | null;
  storage_path: string;
  filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  uploaded_by?: string | null;
}

export interface ProjectInsert {
  id?: string;
  company_id: string;
  external_id?: string | null;
  lead_id?: string | null;
  offer_id?: string | null;
  berater_id?: string | null;
  title: string;
  customer_name: string;
  address_street?: string | null;
  address_zip?: string | null;
  address_city?: string | null;
  phase_id?: string | null;
  status?: ProjectStatus;
  phase_entered_at?: string;
  installation_date?: string | null;
  completion_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectUpdate {
  id?: string;
  company_id?: string;
  external_id?: string | null;
  lead_id?: string | null;
  offer_id?: string | null;
  berater_id?: string | null;
  title?: string;
  customer_name?: string;
  address_street?: string | null;
  address_zip?: string | null;
  address_city?: string | null;
  phase_id?: string | null;
  status?: ProjectStatus;
  phase_entered_at?: string;
  installation_date?: string | null;
  completion_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: connectors
// =============================================================================

export interface ConnectorRow {
  id: string;
  company_id: string;
  holding_id: string;
  type: ConnectorType;
  name: string;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  status: ConnectorStatus;
  last_synced_at: string | null;
  last_error: string | null;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ConnectorInsert {
  id?: string;
  company_id: string;
  type: ConnectorType;
  name: string;
  credentials?: Record<string, unknown>;
  config?: Record<string, unknown>;
  status?: ConnectorStatus;
  last_synced_at?: string | null;
  last_error?: string | null;
  sync_interval_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ConnectorUpdate {
  id?: string;
  company_id?: string;
  type?: ConnectorType;
  name?: string;
  credentials?: Record<string, unknown>;
  config?: Record<string, unknown>;
  status?: ConnectorStatus;
  last_synced_at?: string | null;
  last_error?: string | null;
  sync_interval_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: connector_sync_log
// =============================================================================

export interface ConnectorSyncLogRow {
  id: string;
  connector_id: string;
  company_id: string;
  holding_id: string;
  status: SyncStatus;
  records_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface ConnectorSyncLogInsert {
  id?: string;
  connector_id: string;
  company_id: string;
  status: SyncStatus;
  records_synced?: number;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
  created_at?: string;
}

export interface ConnectorSyncLogUpdate {
  id?: string;
  connector_id?: string;
  company_id?: string;
  status?: SyncStatus;
  records_synced?: number;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
  created_at?: string;
}

// =============================================================================
// TABLE: kpi_snapshots (TimescaleDB hypertable, partition key: period_date)
// =============================================================================

export interface KpiSnapshotRow {
  id: string;
  company_id: string;
  holding_id: string;
  snapshot_type: string;
  entity_id: string | null;
  period_date: string;
  metrics: Record<string, unknown>;
  created_at: string;
}

export interface KpiSnapshotInsert {
  id?: string;
  company_id: string;
  snapshot_type: string;
  entity_id?: string | null;
  period_date: string;
  metrics?: Record<string, unknown>;
  created_at?: string;
}

export interface KpiSnapshotUpdate {
  id?: string;
  company_id?: string;
  snapshot_type?: string;
  entity_id?: string | null;
  period_date?: string;
  metrics?: Record<string, unknown>;
  created_at?: string;
}

// =============================================================================
// TABLE: cashflow_entries (TimescaleDB hypertable, partition key: entry_date)
// =============================================================================

export interface CashflowEntryRow {
  id: string;
  company_id: string;
  holding_id: string;
  entry_date: string;
  type: CashflowType;
  category: string;
  description: string | null;
  amount_chf: string;
  source: string;
  created_at: string;
}

export interface CashflowEntryInsert {
  id?: string;
  company_id: string;
  entry_date: string;
  type: CashflowType;
  category: string;
  description?: string | null;
  amount_chf: string;
  source?: string;
  created_at?: string;
}

export interface CashflowEntryUpdate {
  id?: string;
  company_id?: string;
  entry_date?: string;
  type?: CashflowType;
  category?: string;
  description?: string | null;
  amount_chf?: string;
  source?: string;
  created_at?: string;
}

// =============================================================================
// TABLE: calendar_events (TimescaleDB hypertable, partition key: starts_at)
// =============================================================================

export interface CalendarEventRow {
  id: string;
  company_id: string;
  holding_id: string;
  external_id: string | null;
  team_member_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  event_type: string | null;
  created_at: string;
}

export interface CalendarEventInsert {
  id?: string;
  company_id: string;
  external_id?: string | null;
  team_member_id?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  event_type?: string | null;
  created_at?: string;
}

export interface CalendarEventUpdate {
  id?: string;
  company_id?: string;
  external_id?: string | null;
  team_member_id?: string | null;
  title?: string;
  description?: string | null;
  location?: string | null;
  starts_at?: string;
  ends_at?: string;
  all_day?: boolean;
  event_type?: string | null;
  created_at?: string;
}

// =============================================================================
// TABLE: audit_log (TimescaleDB hypertable, partition key: created_at)
// =============================================================================

export interface AuditLogRow {
  id: string;
  company_id: string | null;
  actor_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogInsert {
  id?: string;
  company_id?: string | null;
  actor_id?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at?: string;
}

export interface AuditLogUpdate {
  id?: string;
  company_id?: string | null;
  actor_id?: string | null;
  action?: string;
  table_name?: string | null;
  record_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at?: string;
}

// =============================================================================
// TABLE: holding_admins
// =============================================================================

export interface HoldingAdminRow {
  id: string;
  profile_id: string;
  created_at: string;
}

export interface HoldingAdminInsert {
  id?: string;
  profile_id: string;
  created_at?: string;
}

export interface HoldingAdminUpdate {
  id?: string;
  profile_id?: string;
  created_at?: string;
}

// =============================================================================
// TABLE: daily_reports
// =============================================================================

export interface DailyReportRow {
  id: string;
  company_id: string;
  holding_id: string;
  report_date: string;
  report_json: Record<string, unknown>;
  kpi_data: Record<string, unknown>;
  sent_to: string[];
  sent_at: string;
}

export interface DailyReportInsert {
  id?: string;
  company_id: string;
  report_date: string;
  report_json: Record<string, unknown>;
  kpi_data: Record<string, unknown>;
  sent_to?: string[];
  sent_at?: string;
}

export interface DailyReportUpdate {
  id?: string;
  company_id?: string;
  report_date?: string;
  report_json?: Record<string, unknown>;
  kpi_data?: Record<string, unknown>;
  sent_to?: string[];
  sent_at?: string;
}

// =============================================================================
// TABLE: tenant_settings
// =============================================================================

export interface CompanySettingsRow {
  company_id: string;
  holding_id: string;
  report_send_time: string;
  report_timezone: string;
  report_recipients_all: boolean;
  stalled_project_days: number;
  unworked_lead_hours: number;
  max_whisper_usd_monthly: string;
  min_liquidity_threshold: string;
  opening_balance: string;
  updated_at: string;
}

export interface CompanySettingsInsert {
  company_id: string;
  report_send_time?: string;
  report_timezone?: string;
  report_recipients_all?: boolean;
  stalled_project_days?: number;
  unworked_lead_hours?: number;
  max_whisper_usd_monthly?: string;
  min_liquidity_threshold?: string;
  opening_balance?: string;
  updated_at?: string;
}

export interface CompanySettingsUpdate {
  company_id?: string;
  report_send_time?: string;
  report_timezone?: string;
  report_recipients_all?: boolean;
  stalled_project_days?: number;
  unworked_lead_hours?: number;
  max_whisper_usd_monthly?: string;
  min_liquidity_threshold?: string;
  opening_balance?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: transcription_usage
// =============================================================================

export interface TranscriptionUsageRow {
  id: string;
  company_id: string;
  holding_id: string;
  month: string;
  total_minutes: string;
  estimated_usd: string;
  updated_at: string;
}

export interface TranscriptionUsageInsert {
  id?: string;
  company_id: string;
  month: string;
  total_minutes?: string;
  estimated_usd?: string;
  updated_at?: string;
}

export interface TranscriptionUsageUpdate {
  id?: string;
  company_id?: string;
  month?: string;
  total_minutes?: string;
  estimated_usd?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: anomalies
// =============================================================================

export interface AnomalyRow {
  id: string;
  company_id: string;
  holding_id: string;
  type: string;
  severity: string;
  entity_id: string | null;
  entity_name: string | null;
  metric: string;
  current_value: number;
  baseline_value: number;
  deviation_pct: number;
  message: string;
  detected_at: string;
  resolved_at: string | null;
  is_active: boolean;
  notified: boolean;
}

export interface AnomalyInsert {
  id?: string;
  company_id: string;
  type: string;
  severity: string;
  entity_id?: string | null;
  entity_name?: string | null;
  metric: string;
  current_value: number;
  baseline_value: number;
  deviation_pct: number;
  message: string;
  detected_at?: string;
  resolved_at?: string | null;
  is_active?: boolean;
  notified?: boolean;
}

export interface AnomalyUpdate {
  id?: string;
  company_id?: string;
  type?: string;
  severity?: string;
  entity_id?: string | null;
  entity_name?: string | null;
  metric?: string;
  current_value?: number;
  baseline_value?: number;
  deviation_pct?: number;
  message?: string;
  detected_at?: string;
  resolved_at?: string | null;
  is_active?: boolean;
  notified?: boolean;
}

// =============================================================================
// TABLE: whatsapp_messages (TimescaleDB hypertable, partition key: sent_at)
// =============================================================================

export type WhatsAppMessageDirection = 'inbound' | 'outbound';

export interface WhatsAppMessageRow {
  id: string;
  company_id: string;
  holding_id: string;
  external_id: string;
  wa_id: string;
  direction: WhatsAppMessageDirection;
  message_type: string;
  body: string | null;
  team_member_id: string | null;
  lead_id: string | null;
  sent_at: string;
  created_at: string;
}

export interface WhatsAppMessageInsert {
  id?: string;
  company_id: string;
  external_id: string;
  wa_id: string;
  direction: WhatsAppMessageDirection;
  message_type?: string;
  body?: string | null;
  team_member_id?: string | null;
  lead_id?: string | null;
  sent_at?: string;
  created_at?: string;
}

export interface WhatsAppMessageUpdate {
  id?: string;
  company_id?: string;
  external_id?: string;
  wa_id?: string;
  direction?: WhatsAppMessageDirection;
  message_type?: string;
  body?: string | null;
  team_member_id?: string | null;
  lead_id?: string | null;
  sent_at?: string;
  created_at?: string;
}

// =============================================================================
// TABLE: email_activity
// =============================================================================

export interface EmailActivityRow {
  id: string;
  company_id: string;
  holding_id: string;
  team_member_id: string;
  activity_date: string;
  emails_sent: number;
  created_at: string;
  updated_at: string;
}

export interface EmailActivityInsert {
  id?: string;
  company_id: string;
  team_member_id: string;
  activity_date: string;
  emails_sent?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmailActivityUpdate {
  id?: string;
  company_id?: string;
  team_member_id?: string;
  activity_date?: string;
  emails_sent?: number;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: holding_secrets
// =============================================================================

export interface HoldingSecretRow {
  id: string;
  holding_id: string;
  name: string;
  secret_type: 'api_key' | 'bearer_token' | 'refresh_token' | 'webhook_secret' | 'service_account' | 'sftp' | 'encryption_key';
  scope: string;
  vault_id: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  last_rotated_at: string | null;
  rotation_interval_days: number | null;
  next_rotation_due: string | null;
}

export interface HoldingSecretInsert {
  holding_id: string;
  name: string;
  secret_type: 'api_key' | 'bearer_token' | 'refresh_token' | 'webhook_secret' | 'service_account' | 'sftp' | 'encryption_key';
  scope?: string;
  vault_id?: string | null;
  description?: string | null;
  is_active?: boolean;
  created_by?: string | null;
  rotation_interval_days?: number | null;
}

export interface HoldingSecretUpdate {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  vault_id?: string | null;
  last_rotated_at?: string | null;
  rotation_interval_days?: number | null;
}

// =============================================================================
// TABLE: tool_registry
// =============================================================================

export interface ToolRegistryRow {
  id: string;
  holding_id: string;
  name: string;
  slug: string;
  category: 'crm' | 'telephony' | 'accounting' | 'calendar' | 'lead_aggregation' | 'messaging' | 'storage' | 'custom';
  base_url: string | null;
  auth_type: 'api_key' | 'oauth2' | 'basic' | 'none' | null;
  secret_ref: string | null;
  default_headers: Record<string, unknown>;
  interface_templates: Record<string, unknown>[];
  is_active: boolean;
  icon_url: string | null;
  docs_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolRegistryInsert {
  holding_id: string;
  name: string;
  slug: string;
  category: 'crm' | 'telephony' | 'accounting' | 'calendar' | 'lead_aggregation' | 'messaging' | 'storage' | 'custom';
  base_url?: string | null;
  auth_type?: 'api_key' | 'oauth2' | 'basic' | 'none' | null;
  secret_ref?: string | null;
  default_headers?: Record<string, unknown>;
  interface_templates?: Record<string, unknown>[];
  is_active?: boolean;
  icon_url?: string | null;
  docs_url?: string | null;
  created_by?: string | null;
}

export interface ToolRegistryUpdate {
  name?: string;
  slug?: string;
  category?: string;
  base_url?: string | null;
  auth_type?: string | null;
  secret_ref?: string | null;
  is_active?: boolean;
  icon_url?: string | null;
  docs_url?: string | null;
}

// =============================================================================
// TABLE: process_definitions
// =============================================================================

export interface ProcessDefinitionRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  template_id: string | null;
  name: string;
  description: string | null;
  category: 'verkauf' | 'planung' | 'abwicklung' | 'betrieb' | 'sonstige';
  menu_label: string;
  menu_icon: string;
  menu_sort_order: number;
  visible_roles: string[];
  status: 'draft' | 'finalised' | 'pending_approval' | 'deployed' | 'archived';
  version: string;
  deployed_at: string | null;
  deployed_version: string | null;
  process_type: 'M' | 'P' | 'S' | null;
  house_sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessDefinitionInsert {
  holding_id: string;
  company_id?: string | null;
  template_id?: string | null;
  name: string;
  description?: string | null;
  category?: 'verkauf' | 'planung' | 'abwicklung' | 'betrieb' | 'sonstige';
  menu_label: string;
  menu_icon?: string;
  menu_sort_order?: number;
  visible_roles?: string[];
  status?: string;
  version?: string;
  process_type?: 'M' | 'P' | 'S' | null;
  house_sort_order?: number;
  created_by?: string | null;
}

export interface ProcessDefinitionUpdate {
  name?: string;
  description?: string | null;
  category?: string;
  menu_label?: string;
  menu_icon?: string;
  menu_sort_order?: number;
  visible_roles?: string[];
  status?: string;
  version?: string;
  deployed_at?: string | null;
  deployed_version?: string | null;
  process_type?: 'M' | 'P' | 'S' | null;
  house_sort_order?: number;
}

// =============================================================================
// TABLE: process_kpi_definitions
// =============================================================================

export interface ProcessKpiDefinitionRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  process_id: string;
  phase_id: string | null;
  name: string;
  description: string | null;
  unit: string;
  target_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  data_source: string | null;
  visible_roles: string[];
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessKpiDefinitionInsert {
  holding_id: string;
  company_id?: string | null;
  process_id: string;
  phase_id?: string | null;
  name: string;
  description?: string | null;
  unit?: string;
  target_value?: number | null;
  warning_threshold?: number | null;
  critical_threshold?: number | null;
  data_source?: string | null;
  visible_roles?: string[];
  sort_order?: number;
  is_active?: boolean;
  created_by?: string | null;
}

export interface ProcessKpiDefinitionUpdate {
  name?: string;
  description?: string | null;
  unit?: string;
  target_value?: number | null;
  warning_threshold?: number | null;
  critical_threshold?: number | null;
  data_source?: string | null;
  visible_roles?: string[];
  sort_order?: number;
  is_active?: boolean;
}

// =============================================================================
// TABLE: process_kpi_values
// =============================================================================

export interface ProcessKpiValueRow {
  id: string;
  kpi_id: string;
  period_date: string;
  value: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProcessKpiValueInsert {
  kpi_id: string;
  period_date: string;
  value?: number | null;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// TABLE: process_steps
// =============================================================================

export interface ProcessStepRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  process_id: string;
  process_step_id: string;
  name: string;
  main_process: 'vertrieb' | 'planung' | 'abwicklung' | 'service' | null;
  description: string;
  responsible_roles: string[];
  expected_output: string | null;
  typical_hours: number | null;
  warning_days: number | null;
  show_in_flowchart: boolean;
  liquidity_marker: 'trigger' | 'event' | null;
  phase_id: string | null;
  criticality: 'A' | 'B' | 'C' | null;
  rhythm: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessStepInsert {
  holding_id: string;
  company_id?: string | null;
  process_id: string;
  process_step_id: string;
  name: string;
  main_process?: string | null;
  description?: string;
  responsible_roles?: string[];
  expected_output?: string | null;
  typical_hours?: number | null;
  warning_days?: number | null;
  show_in_flowchart?: boolean;
  liquidity_marker?: string | null;
  phase_id?: string | null;
  sort_order?: number;
}

export interface ProcessStepUpdate {
  name?: string;
  main_process?: string | null;
  description?: string;
  responsible_roles?: string[];
  expected_output?: string | null;
  typical_hours?: number | null;
  warning_days?: number | null;
  show_in_flowchart?: boolean;
  liquidity_marker?: string | null;
  phase_id?: string | null;
  sort_order?: number;
}

// =============================================================================
// TABLE: process_phases
// =============================================================================

export interface ProcessPhaseRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  process_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessPhaseInsert {
  holding_id: string;
  company_id?: string | null;
  process_id: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  color?: string | null;
}

export interface ProcessPhaseUpdate {
  name?: string;
  description?: string | null;
  sort_order?: number;
  color?: string | null;
}

// =============================================================================
// TABLE: process_step_sources
// =============================================================================

export interface ProcessStepSourceRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  process_id: string;
  step_id: string;
  label: string;
  source_type: 'rest_api' | 'webhook' | 'file' | 'supabase' | 'google' | 'manual' | 'other';
  tool_name: string | null;
  endpoint: string | null;
  description: string | null;
  sort_order: number;
}

export interface ProcessStepSourceInsert {
  holding_id: string;
  company_id?: string | null;
  process_id: string;
  step_id: string;
  label: string;
  source_type: string;
  tool_name?: string | null;
  endpoint?: string | null;
  description?: string | null;
  sort_order?: number;
}

export interface ProcessStepSourceUpdate {
  label?: string;
  source_type?: string;
  tool_name?: string | null;
  endpoint?: string | null;
  description?: string | null;
  sort_order?: number;
}

// =============================================================================
// TABLE: process_step_interfaces
// =============================================================================

export interface ProcessStepInterfaceRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  process_id: string;
  step_id: string;
  label: string;
  interface_type: 'rest_pull' | 'rest_push' | 'webhook_in' | 'webhook_out' | 'file_in' | 'file_out' | 'internal';
  protocol: 'https' | 'sftp' | 's3' | 'internal';
  tool_registry_id: string | null;
  endpoint: string | null;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null;
  request_schema: Record<string, unknown> | null;
  response_schema: Record<string, unknown> | null;
  field_mapping: Record<string, unknown>[];
  secret_ref: string | null;
  sync_interval_min: number;
  trigger_condition: string | null;
  retry_policy: 'none' | 'exponential_3x' | 'alert_manual';
  timeout_sec: number;
  sort_order: number;
}

export interface ProcessStepInterfaceInsert {
  holding_id: string;
  company_id?: string | null;
  process_id: string;
  step_id: string;
  label: string;
  interface_type: string;
  protocol?: string;
  tool_registry_id?: string | null;
  endpoint?: string | null;
  http_method?: string | null;
  request_schema?: Record<string, unknown> | null;
  response_schema?: Record<string, unknown> | null;
  field_mapping?: Record<string, unknown>[];
  secret_ref?: string | null;
  sync_interval_min?: number;
  trigger_condition?: string | null;
  retry_policy?: string;
  timeout_sec?: number;
  sort_order?: number;
}

export interface ProcessStepInterfaceUpdate {
  label?: string;
  interface_type?: string;
  endpoint?: string | null;
  http_method?: string | null;
  request_schema?: Record<string, unknown> | null;
  response_schema?: Record<string, unknown> | null;
  field_mapping?: Record<string, unknown>[];
  secret_ref?: string | null;
  sync_interval_min?: number;
  trigger_condition?: string | null;
  retry_policy?: string;
  timeout_sec?: number;
  sort_order?: number;
}

// =============================================================================
// TABLE: process_step_liquidity
// =============================================================================

export interface ProcessStepLiquidityRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  process_id: string;
  step_id: string;
  marker_type: 'trigger' | 'event';
  trigger_step_id: string | null;
  event_step_id: string | null;
  direction: 'income' | 'expense';
  plan_currency: string;
  plan_amount: string | null;
  amount_type: 'fixed' | 'percentage';
  actual_currency: string | null;
  fx_rate: string | null;
  fx_rate_date: string | null;
  plan_delay_days: number | null;
  plan_date: string | null;
  actual_date: string | null;
  actual_amount: string | null;
  source_tool: string | null;
}

export interface ProcessStepLiquidityInsert {
  holding_id: string;
  company_id?: string | null;
  process_id: string;
  step_id: string;
  marker_type: 'trigger' | 'event';
  direction: 'income' | 'expense';
  plan_currency?: string;
  plan_amount?: string | null;
  amount_type?: 'fixed' | 'percentage';
  trigger_step_id?: string | null;
  event_step_id?: string | null;
  plan_delay_days?: number | null;
  source_tool?: string | null;
}

export interface ProcessStepLiquidityUpdate {
  marker_type?: 'trigger' | 'event';
  direction?: 'income' | 'expense';
  plan_currency?: string;
  plan_amount?: string | null;
  amount_type?: string;
  plan_delay_days?: number | null;
  actual_date?: string | null;
  actual_amount?: string | null;
  source_tool?: string | null;
}

// =============================================================================
// TABLE: process_versions
// =============================================================================

export interface ProcessVersionRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  process_id: string;
  version: string;
  snapshot: Record<string, unknown>;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProcessVersionInsert {
  holding_id: string;
  company_id?: string | null;
  process_id: string;
  version: string;
  snapshot: Record<string, unknown>;
  change_summary?: string | null;
  created_by?: string | null;
}

export interface ProcessVersionUpdate {}

// =============================================================================
// TABLE: process_deployments
// =============================================================================

export interface ProcessDeploymentRow {
  id: string;
  holding_id: string;
  company_id: string;
  process_id: string;
  version: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'deployed' | 'rolled_back';
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  deployed_at: string | null;
  reason: string | null;
  rollback_of: string | null;
}

export interface ProcessDeploymentInsert {
  holding_id: string;
  company_id: string;
  process_id: string;
  version: string;
  status?: string;
  requested_by: string;
  reason?: string | null;
  rollback_of?: string | null;
}

export interface ProcessDeploymentUpdate {
  status?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  deployed_at?: string | null;
}

// =============================================================================
// TABLE: process_templates
// =============================================================================

export interface ProcessTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: 'verkauf' | 'planung' | 'abwicklung' | 'betrieb' | 'sonstige';
  steps: Record<string, unknown>[];
  version: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessTemplateInsert {
  name: string;
  description?: string | null;
  category: string;
  steps?: Record<string, unknown>[];
  version?: string;
  is_active?: boolean;
  created_by?: string | null;
}

export interface ProcessTemplateUpdate {
  name?: string;
  description?: string | null;
  category?: string;
  steps?: Record<string, unknown>[];
  version?: string;
  is_active?: boolean;
}

// =============================================================================
// TABLE: company_currency_settings
// =============================================================================

export interface CompanyCurrencySettingsRow {
  company_id: string;
  holding_id: string;
  base_currency: string;
  enabled_currencies: string[];
  eur_chf_rate: string;
  rate_updated_at: string | null;
  fx_source: string;
  updated_at: string;
}

export interface CompanyCurrencySettingsInsert {
  company_id: string;
  holding_id: string;
  base_currency?: string;
  enabled_currencies?: string[];
  eur_chf_rate?: string;
  fx_source?: string;
}

export interface CompanyCurrencySettingsUpdate {
  base_currency?: string;
  enabled_currencies?: string[];
  eur_chf_rate?: string;
  rate_updated_at?: string | null;
  fx_source?: string;
}

// =============================================================================
// TABLE: compliance_rules
// =============================================================================

export type ComplianceRuleTriggerEvent =
  | 'connector_created'
  | 'company_created'
  | 'holding_created'
  | 'document_uploaded'
  | 'secret_rotated'
  | 'manual'
  | 'scheduled';

export type ComplianceSeverity = 'critical' | 'warning' | 'info';

export interface ComplianceRuleRow {
  id: string;
  rule_code: string;
  title: string;
  description: string;
  trigger_event: ComplianceRuleTriggerEvent;
  trigger_filter: Record<string, unknown>;
  requirement: string;
  deadline_days: number;
  severity: ComplianceSeverity;
  legal_basis: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ComplianceRuleInsert {
  id?: string;
  rule_code: string;
  title: string;
  description?: string;
  trigger_event: ComplianceRuleTriggerEvent;
  trigger_filter?: Record<string, unknown>;
  requirement?: string;
  deadline_days?: number;
  severity: ComplianceSeverity;
  legal_basis?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface ComplianceRuleUpdate {
  rule_code?: string;
  title?: string;
  description?: string;
  trigger_event?: ComplianceRuleTriggerEvent;
  trigger_filter?: Record<string, unknown>;
  requirement?: string;
  deadline_days?: number;
  severity?: ComplianceSeverity;
  legal_basis?: string | null;
  is_active?: boolean;
}

// =============================================================================
// TABLE: compliance_checks
// =============================================================================

export type ComplianceCheckStatus = 'open' | 'fulfilled' | 'overdue' | 'waived';

export interface ComplianceCheckRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  rule_id: string;
  rule_code: string;
  status: ComplianceCheckStatus;
  triggered_by: string;
  triggered_at: string;
  due_at: string;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  waived_by: string | null;
  waive_reason: string | null;
  waive_expires_at: string | null;
  notes: string | null;
  notified_at: string | null;
}

export interface ComplianceCheckInsert {
  id?: string;
  holding_id: string;
  company_id?: string | null;
  rule_id: string;
  rule_code: string;
  status?: ComplianceCheckStatus;
  triggered_by?: string;
  triggered_at?: string;
  due_at: string;
  fulfilled_at?: string | null;
  fulfilled_by?: string | null;
  waived_by?: string | null;
  waive_reason?: string | null;
  waive_expires_at?: string | null;
  notes?: string | null;
  notified_at?: string | null;
}

export interface ComplianceCheckUpdate {
  status?: ComplianceCheckStatus;
  fulfilled_at?: string | null;
  fulfilled_by?: string | null;
  waived_by?: string | null;
  waive_reason?: string | null;
  waive_expires_at?: string | null;
  notes?: string | null;
  notified_at?: string | null;
}

// =============================================================================
// TABLE: compliance_documents
// =============================================================================

export type ComplianceDocumentType =
  | 'avv'
  | 'dpa'
  | 'dsfa'
  | 'tom'
  | 'certificate'
  | 'audit_report'
  | 'vvt'
  | 'consent_form'
  | 'other';

export interface ComplianceDocumentRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  check_id: string | null;
  document_type: ComplianceDocumentType;
  title: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  valid_from: string | null;
  expires_at: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ComplianceDocumentInsert {
  id?: string;
  holding_id: string;
  company_id?: string | null;
  check_id?: string | null;
  document_type: ComplianceDocumentType;
  title: string;
  storage_path: string;
  file_size?: number;
  mime_type?: string;
  valid_from?: string | null;
  expires_at?: string | null;
  uploaded_by: string;
  uploaded_at?: string;
}

export interface ComplianceDocumentUpdate {
  document_type?: ComplianceDocumentType;
  title?: string;
  storage_path?: string;
  file_size?: number;
  mime_type?: string;
  valid_from?: string | null;
  expires_at?: string | null;
  check_id?: string | null;
}

// =============================================================================
// TABLE: certifications
// =============================================================================

export type CertificationLevel = 'platform' | 'holding' | 'company';
export type CertificationStatus = 'planned' | 'in_progress' | 'certified' | 'expired';

export interface CertificationRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  level: CertificationLevel;
  certification: string;
  status: CertificationStatus;
  certified_at: string | null;
  expires_at: string | null;
  document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificationInsert {
  id?: string;
  holding_id: string;
  company_id?: string | null;
  level: CertificationLevel;
  certification: string;
  status?: CertificationStatus;
  certified_at?: string | null;
  expires_at?: string | null;
  document_id?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CertificationUpdate {
  level?: CertificationLevel;
  certification?: string;
  status?: CertificationStatus;
  certified_at?: string | null;
  expires_at?: string | null;
  document_id?: string | null;
  notes?: string | null;
  updated_at?: string;
}

// =============================================================================
// TABLE: project_process_instances
// =============================================================================

export type ProjectProcessInstanceStatus = 'active' | 'completed' | 'cancelled';

export interface ProjectProcessInstanceRow {
  id: string;
  holding_id: string;
  company_id: string;
  project_id: string;
  process_id: string;
  process_version: string;
  started_at: string;
  completed_at: string | null;
  status: ProjectProcessInstanceStatus;
}

export interface ProjectProcessInstanceInsert {
  id?: string;
  holding_id: string;
  company_id: string;
  project_id: string;
  process_id: string;
  process_version: string;
  started_at?: string;
  completed_at?: string | null;
  status?: ProjectProcessInstanceStatus;
}

export interface ProjectProcessInstanceUpdate {
  process_version?: string;
  completed_at?: string | null;
  status?: ProjectProcessInstanceStatus;
}

// =============================================================================
// TABLE: liquidity_event_instances
// =============================================================================

export type LiquidityMarkerType = 'trigger' | 'event';
export type LiquidityDirection = 'income' | 'expense';
export type LiquidityAmountType = 'fixed' | 'percentage';
export type LiquidityActualSource = 'bexio' | 'bank_upload' | 'manual' | 'connector';

export interface LiquidityEventInstanceRow {
  id: string;
  holding_id: string;
  company_id: string;
  instance_id: string;
  project_id: string;
  process_id: string;
  step_id: string;
  process_step_id: string;
  step_name: string;
  marker_type: LiquidityMarkerType;
  linked_instance_id: string | null;
  direction: LiquidityDirection;
  plan_currency: string;
  budget_amount: string | null;
  amount_type: LiquidityAmountType;
  plan_delay_days: number | null;
  trigger_activated_at: string | null;
  budget_date: string | null;
  actual_date: string | null;
  actual_currency: string | null;
  actual_amount: string | null;
  fx_rate: string | null;
  fx_rate_date: string | null;
  actual_source: LiquidityActualSource | null;
  actual_source_ref: string | null;
  matched_at: string | null;
  matched_by: string | null;
  amount_deviation: string | null;
  date_deviation_days: number | null;
  // Scheduled (set by Cash-out Planer)
  scheduled_amount: string | null;
  scheduled_date: string | null;
  scheduled_by: string | null;
  scheduled_at: string | null;
  // Residual values
  residual_1_amount: string | null;
  residual_1_date: string | null;
  residual_2_amount: string | null;
  residual_2_date: string | null;
  residual_3_amount: string | null;
  residual_3_date: string | null;
  // Invoice link
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiquidityEventInstanceInsert {
  id?: string;
  holding_id: string;
  company_id: string;
  instance_id: string;
  project_id: string;
  process_id: string;
  step_id: string;
  process_step_id: string;
  step_name: string;
  marker_type: LiquidityMarkerType;
  linked_instance_id?: string | null;
  direction: LiquidityDirection;
  plan_currency?: string;
  budget_amount?: string | null;
  amount_type?: LiquidityAmountType;
  plan_delay_days?: number | null;
  trigger_activated_at?: string | null;
  budget_date?: string | null;
  actual_date?: string | null;
  actual_currency?: string | null;
  actual_amount?: string | null;
  fx_rate?: string | null;
  fx_rate_date?: string | null;
  actual_source?: LiquidityActualSource | null;
  actual_source_ref?: string | null;
  matched_at?: string | null;
  matched_by?: string | null;
  amount_deviation?: string | null;
  date_deviation_days?: number | null;
  scheduled_amount?: string | null;
  scheduled_date?: string | null;
  scheduled_by?: string | null;
  scheduled_at?: string | null;
  residual_1_amount?: string | null;
  residual_1_date?: string | null;
  residual_2_amount?: string | null;
  residual_2_date?: string | null;
  residual_3_amount?: string | null;
  residual_3_date?: string | null;
  invoice_id?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LiquidityEventInstanceUpdate {
  linked_instance_id?: string | null;
  budget_amount?: string | null;
  plan_delay_days?: number | null;
  trigger_activated_at?: string | null;
  budget_date?: string | null;
  actual_date?: string | null;
  actual_currency?: string | null;
  actual_amount?: string | null;
  fx_rate?: string | null;
  fx_rate_date?: string | null;
  actual_source?: LiquidityActualSource | null;
  actual_source_ref?: string | null;
  matched_at?: string | null;
  matched_by?: string | null;
  amount_deviation?: string | null;
  date_deviation_days?: number | null;
  notes?: string | null;
}

// =============================================================================
// TABLE: bank_upload_files
// =============================================================================

export type BankFileFormat = 'camt053' | 'mt940' | 'csv';

export interface BankUploadFileRow {
  id: string;
  holding_id: string;
  company_id: string;
  filename: string;
  file_format: BankFileFormat;
  storage_path: string;
  period_from: string | null;
  period_to: string | null;
  transaction_count: number | null;
  processed_at: string | null;
  matched_count: number;
  unmatched_count: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface BankUploadFileInsert {
  id?: string;
  holding_id: string;
  company_id: string;
  filename: string;
  file_format: BankFileFormat;
  storage_path: string;
  period_from?: string | null;
  period_to?: string | null;
  transaction_count?: number | null;
  processed_at?: string | null;
  matched_count?: number;
  unmatched_count?: number;
  uploaded_by: string;
  uploaded_at?: string;
}

export interface BankUploadFileUpdate {
  period_from?: string | null;
  period_to?: string | null;
  transaction_count?: number | null;
  processed_at?: string | null;
  matched_count?: number;
  unmatched_count?: number;
}

// =============================================================================
// TABLE: bank_transactions
// =============================================================================

export type BankTransactionDirection = 'credit' | 'debit';
export type BankTransactionStatus = 'unmatched' | 'matched' | 'ignored';

export interface BankTransactionRow {
  id: string;
  holding_id: string;
  company_id: string;
  upload_id: string;
  transaction_date: string;
  value_date: string | null;
  amount: string;
  currency: string;
  direction: BankTransactionDirection;
  reference: string | null;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  description: string | null;
  matched_to: string | null;
  match_confidence: string | null;
  status: BankTransactionStatus;
}

export interface BankTransactionInsert {
  id?: string;
  holding_id: string;
  company_id: string;
  upload_id: string;
  transaction_date: string;
  value_date?: string | null;
  amount: string;
  currency?: string;
  direction: BankTransactionDirection;
  reference?: string | null;
  counterparty_name?: string | null;
  counterparty_iban?: string | null;
  description?: string | null;
  matched_to?: string | null;
  match_confidence?: string | null;
  status?: BankTransactionStatus;
}

export interface BankTransactionUpdate {
  value_date?: string | null;
  matched_to?: string | null;
  match_confidence?: string | null;
  status?: BankTransactionStatus;
  description?: string | null;
}

// =============================================================================
// TABLE: interface_execution_log
// =============================================================================

export type InterfaceExecutionStatus = 'success' | 'error' | 'timeout' | 'skipped';

export interface InterfaceExecutionLogRow {
  id: number;
  holding_id: string | null;
  company_id: string | null;
  interface_id: string | null;
  step_id: string | null;
  process_id: string | null;
  executed_at: string;
  trigger: string;
  status: InterfaceExecutionStatus;
  http_status: number | null;
  duration_ms: number | null;
  retry_count: number;
  error_message: string | null;
  error_context: Record<string, unknown> | null;
}

export interface InterfaceExecutionLogInsert {
  id?: number;
  holding_id?: string | null;
  company_id?: string | null;
  interface_id?: string | null;
  step_id?: string | null;
  process_id?: string | null;
  executed_at?: string;
  trigger: string;
  status: InterfaceExecutionStatus;
  http_status?: number | null;
  duration_ms?: number | null;
  retry_count?: number;
  error_message?: string | null;
  error_context?: Record<string, unknown> | null;
}

export interface InterfaceExecutionLogUpdate {
  status?: InterfaceExecutionStatus;
  http_status?: number | null;
  duration_ms?: number | null;
  retry_count?: number;
  error_message?: string | null;
  error_context?: Record<string, unknown> | null;
}

// =============================================================================
// TABLE: holding_subscriptions
// =============================================================================

export type SubscriptionPlan = 'starter' | 'professional' | 'scale' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';

export interface HoldingSubscriptionRow {
  id: string;
  holding_id: string;
  plan: SubscriptionPlan;
  company_plan: SubscriptionPlan;
  billing_cycle: BillingCycle;
  ai_calls_enabled: boolean;
  process_builder_enabled: boolean;
  liquidity_enabled: boolean;
  max_companies: number;
  max_users_per_company: number;
  trial_ends_at: string | null;
  activated_at: string | null;
  notes: string | null;
  finanzplanung_enabled: boolean;
  finanzplanung_activated_at: string | null;
  finanzplanung_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingSubscriptionInsert {
  id?: string;
  holding_id: string;
  plan?: SubscriptionPlan;
  company_plan?: SubscriptionPlan;
  billing_cycle?: BillingCycle;
  ai_calls_enabled?: boolean;
  process_builder_enabled?: boolean;
  liquidity_enabled?: boolean;
  max_companies?: number;
  max_users_per_company?: number;
  trial_ends_at?: string | null;
  activated_at?: string | null;
  notes?: string | null;
  finanzplanung_enabled?: boolean;
  finanzplanung_activated_at?: string | null;
  finanzplanung_notes?: string | null;
}

export interface HoldingSubscriptionUpdate {
  plan?: SubscriptionPlan;
  company_plan?: SubscriptionPlan;
  billing_cycle?: BillingCycle;
  ai_calls_enabled?: boolean;
  process_builder_enabled?: boolean;
  liquidity_enabled?: boolean;
  max_companies?: number;
  max_users_per_company?: number;
  trial_ends_at?: string | null;
  activated_at?: string | null;
  notes?: string | null;
  finanzplanung_enabled?: boolean;
  finanzplanung_activated_at?: string | null;
  finanzplanung_notes?: string | null;
}

// =============================================================================
// TABLE: holding_onboarding
// =============================================================================

export interface HoldingOnboardingRow {
  id: string;
  holding_id: string;
  current_step: number;
  completed_steps: number[];
  wizard_data: Record<string, unknown>;
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingOnboardingInsert {
  id?: string;
  holding_id: string;
  current_step?: number;
  completed_steps?: number[];
  wizard_data?: Record<string, unknown>;
  is_complete?: boolean;
  completed_at?: string | null;
}

export interface HoldingOnboardingUpdate {
  current_step?: number;
  completed_steps?: number[];
  wizard_data?: Record<string, unknown>;
  is_complete?: boolean;
  completed_at?: string | null;
}

// =============================================================================
// TABLE: user_invitations
// =============================================================================

export interface UserInvitationRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  email: string;
  role_name: string;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface UserInvitationInsert {
  id?: string;
  holding_id: string;
  company_id?: string | null;
  email: string;
  role_name: string;
  invited_by: string;
  token?: string;
  expires_at?: string;
  accepted_at?: string | null;
  accepted_by?: string | null;
  revoked_at?: string | null;
}

export interface UserInvitationUpdate {
  company_id?: string | null;
  email?: string;
  role_name?: string;
  expires_at?: string;
  accepted_at?: string | null;
  accepted_by?: string | null;
  revoked_at?: string | null;
}

// =============================================================================
// TABLE: platform_metrics
// =============================================================================

export interface PlatformMetricRow {
  id: number;
  measured_at: string;
  total_holdings: number;
  active_holdings: number;
  total_companies: number;
  total_users: number;
  ai_calls_24h: number;
  deployments_24h: number;
}

export interface PlatformMetricInsert {
  id?: number;
  measured_at?: string;
  total_holdings?: number;
  active_holdings?: number;
  total_companies?: number;
  total_users?: number;
  ai_calls_24h?: number;
  deployments_24h?: number;
}

export interface PlatformMetricUpdate {
  measured_at?: string;
  total_holdings?: number;
  active_holdings?: number;
  total_companies?: number;
  total_users?: number;
  ai_calls_24h?: number;
  deployments_24h?: number;
}

// =============================================================================
// TABLE: help_snippets
// =============================================================================

export type HelpLocale = 'de' | 'en' | 'fr' | 'it';

export interface HelpSnippetRow {
  id: string;
  location_key: string;
  locale: HelpLocale;
  title: string;
  content: string;
  article_slug: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface HelpSnippetInsert {
  id?: string;
  location_key: string;
  locale: HelpLocale;
  title: string;
  content: string;
  article_slug?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export interface HelpSnippetUpdate {
  location_key?: string;
  locale?: HelpLocale;
  title?: string;
  content?: string;
  article_slug?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

// =============================================================================
// TABLE: user_tour_progress
// =============================================================================

export interface UserTourProgressRow {
  profile_id: string;
  tour_id: string;
  started_at: string;
  completed_at: string | null;
  last_step: number;
  skipped: boolean;
}

export interface UserTourProgressInsert {
  profile_id: string;
  tour_id: string;
  started_at?: string;
  completed_at?: string | null;
  last_step?: number;
  skipped?: boolean;
}

export interface UserTourProgressUpdate {
  completed_at?: string | null;
  last_step?: number;
  skipped?: boolean;
}

// =============================================================================
// TABLE: help_feedback
// =============================================================================

export interface HelpFeedbackRow {
  id: string;
  article_slug: string;
  profile_id: string;
  locale: HelpLocale;
  helpful: boolean;
  comment: string | null;
  created_at: string;
}

export interface HelpFeedbackInsert {
  id?: string;
  article_slug: string;
  profile_id: string;
  locale: HelpLocale;
  helpful: boolean;
  comment?: string | null;
  created_at?: string;
}

export interface HelpFeedbackUpdate {
  helpful?: boolean;
  comment?: string | null;
}

// =============================================================================
// TABLE: company_feature_flags (Finanzplanung licensing)
// =============================================================================

export interface CompanyFeatureFlagsRow {
  company_id: string;
  holding_id: string;
  finanzplanung_enabled: boolean;
  finanzplanung_activated_at: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface CompanyFeatureFlagsInsert {
  company_id: string;
  holding_id: string;
  finanzplanung_enabled?: boolean;
  finanzplanung_activated_at?: string | null;
  updated_by?: string | null;
}

export interface CompanyFeatureFlagsUpdate {
  finanzplanung_enabled?: boolean;
  finanzplanung_activated_at?: string | null;
  updated_by?: string | null;
}

// =============================================================================
// TABLE: suppliers
// =============================================================================

export interface SupplierRow {
  id: string;
  holding_id: string;
  company_id: string | null;
  name: string;
  name_normalized: string;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  registration_number: string | null;
  vat_number: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  preferred_payment_days: number;
  is_active: boolean;
  bank_data_verified: boolean;
  active_bank_data_id: string | null;
  created_from_invoice: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierInsert {
  holding_id: string;
  company_id?: string | null;
  name: string;
  country?: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  iban?: string | null;
  bic?: string | null;
  bank_name?: string | null;
  preferred_payment_days?: number;
  is_active?: boolean;
  created_from_invoice?: string | null;
  created_by?: string | null;
}

export interface SupplierUpdate {
  name?: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string;
  registration_number?: string | null;
  vat_number?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  iban?: string | null;
  bic?: string | null;
  bank_name?: string | null;
  preferred_payment_days?: number;
  is_active?: boolean;
}

// =============================================================================
// TABLE: supplier_bank_data
// =============================================================================

export interface SupplierBankDataRow {
  id: string;
  supplier_id: string;
  holding_id: string;
  company_id: string;
  version: number;
  iban: string;
  bic: string | null;
  bank_name: string | null;
  is_active: boolean;
  activated_at: string | null;
  deactivated_at: string | null;
  created_by: string;
  created_at: string;
}

// =============================================================================
// TABLE: supplier_bank_change_requests
// =============================================================================

export type BankChangeRequestStatus =
  | 'pending_review'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type BankChangeSource =
  | 'internal'
  | 'supplier_request'
  | 'invoice_mismatch';

export interface SupplierBankChangeRequestRow {
  id: string;
  supplier_id: string;
  holding_id: string;
  company_id: string;
  proposed_iban: string;
  proposed_bic: string | null;
  proposed_bank_name: string | null;
  reason: string;
  source: BankChangeSource;
  evidence_storage_path: string | null;
  status: BankChangeRequestStatus;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_comment: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  resulting_bank_data_id: string | null;
  is_urgent: boolean;
  urgent_justification: string | null;
}

// =============================================================================
// TABLE: supplier_bank_change_log
// =============================================================================

export type BankChangeLogAction =
  | 'created'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'activated'
  | 'evidence_uploaded';

export interface SupplierBankChangeLogRow {
  id: string;
  request_id: string | null;
  holding_id: string;
  company_id: string;
  action: BankChangeLogAction;
  actor_id: string;
  old_status: string | null;
  new_status: string | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// =============================================================================
// Finanzplanung: Invoice types
// =============================================================================

export type FinanzplanungInvoiceStatus =
  | 'received' | 'extraction_done' | 'match_review'
  | 'in_validation' | 'returned_formal' | 'formally_approved'
  | 'pending_approval' | 'returned_internal' | 'returned_sender'
  | 'approved' | 'scheduled' | 'in_payment_run' | 'paid';

export interface InvoiceIncomingRow {
  id: string;
  holding_id: string;
  company_id: string;
  project_id: string | null;
  step_id: string | null;
  supplier_id: string | null;
  raw_storage_path: string;
  raw_filename: string | null;
  raw_mime_type: string | null;
  incomer_type: 'email' | 'sftp' | 'webhook' | 'manual_upload';
  incomer_ref: string | null;
  incomer_received_at: string;
  extracted_data: Record<string, unknown> | null;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  extraction_error: string | null;
  extraction_model: string | null;
  extraction_at: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  recipient_reg_number: string | null;
  sender_name: string | null;
  sender_address: string | null;
  sender_reg_number: string | null;
  sender_vat_number: string | null;
  sender_email: string | null;
  sender_contact_name: string | null;
  sender_contact_phone: string | null;
  net_amount: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  currency: string;
  payment_terms_days: number | null;
  payment_terms_text: string | null;
  due_date: string | null;
  project_ref_raw: string | null;
  customer_name_raw: string | null;
  customer_address_raw: string | null;
  match_confidence: number | null;
  match_method: string | null;
  status: FinanzplanungInvoiceStatus;
  is_duplicate: boolean;
  duplicate_of: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceIncomingInsert {
  holding_id: string;
  company_id: string;
  raw_storage_path: string;
  incomer_type: 'email' | 'sftp' | 'webhook' | 'manual_upload';
  currency?: string;
  status?: FinanzplanungInvoiceStatus;
  [key: string]: unknown;
}

export interface InvoiceIncomingUpdate {
  [key: string]: unknown;
}

export interface InvoiceLineItemRow {
  id: string;
  invoice_id: string;
  holding_id: string;
  company_id: string;
  position: number;
  article_number: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
  vat_rate: number | null;
}

// =============================================================================
// Finanzplanung: Payment types
// =============================================================================

export type PaymentRunStatus =
  | 'draft' | 'submitted' | 'under_review'
  | 'approved' | 'rejected' | 'exported' | 'confirmed_paid';

export interface PaymentRunRow {
  id: string;
  holding_id: string;
  company_id: string;
  run_date: string;
  name: string | null;
  created_by: string;
  created_at: string;
  total_amount: number;
  item_count: number;
  currency: string;
  status: PaymentRunStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  planner_reviewed_all: boolean;
  approved_by: string | null;
  approved_at: string | null;
  approver_reviewed_all: boolean;
  rejection_reason: string | null;
  payment_format: string | null;
  file_storage_path: string | null;
  exported_at: string | null;
  exported_by: string | null;
  notes: string | null;
}

export interface PaymentRunItemRow {
  id: string;
  run_id: string;
  holding_id: string;
  company_id: string;
  invoice_id: string;
  supplier_id: string | null;
  creditor_name: string;
  creditor_iban: string;
  creditor_bic: string | null;
  amount: number;
  currency: string;
  payment_reference: string | null;
  remittance_info: string | null;
  reviewed_by_planner: boolean;
  reviewed_by_planner_at: string | null;
  reviewed_by_approver: boolean;
  reviewed_by_approver_at: string | null;
  sort_order: number;
}

export interface CashoutResidualDecisionRow {
  id: string;
  holding_id: string;
  company_id: string;
  instance_id: string;
  invoice_id: string;
  residual_number: 1 | 2 | 3;
  decision: 'keep' | 'zero';
  residual_amount: number | null;
  residual_date: string | null;
  decided_by: string;
  decided_at: string;
  notes: string | null;
}

export interface CompanyBankingConfigRow {
  company_id: string;
  holding_id: string;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  payment_format: 'pain001_sepa' | 'pain001_ch' | 'mt101' | 'csv_custom';
  csv_column_mapping: Record<string, unknown> | null;
  creditor_id: string | null;
  updated_at: string;
}

// =============================================================================
// Supabase JS Client Compatible Database Type
// =============================================================================

export interface Database {
  public: {
    Tables: {
      companies: { Row: CompanyRow; Insert: CompanyInsert; Update: CompanyUpdate; Relationships: [] };
      holdings: { Row: HoldingRow; Insert: HoldingInsert; Update: HoldingUpdate; Relationships: [] };
      domain_mappings: { Row: DomainMappingRow; Insert: DomainMappingInsert; Update: DomainMappingUpdate; Relationships: [] };
      holding_admins_v2: { Row: HoldingAdminV2Row; Insert: HoldingAdminV2Insert; Update: HoldingAdminV2Update; Relationships: [] };
      enura_admins: { Row: EnuraAdminRow; Insert: EnuraAdminInsert; Update: EnuraAdminUpdate; Relationships: [] };
      company_branding: { Row: CompanyBrandingRow; Insert: CompanyBrandingInsert; Update: CompanyBrandingUpdate; Relationships: [] };
      profiles: { Row: ProfileRow; Insert: ProfileInsert; Update: ProfileUpdate; Relationships: [] };
      roles: { Row: RoleRow; Insert: RoleInsert; Update: RoleUpdate; Relationships: [] };
      permissions: { Row: PermissionRow; Insert: PermissionInsert; Update: PermissionUpdate; Relationships: [] };
      role_permissions: { Row: RolePermissionRow; Insert: RolePermissionInsert; Update: RolePermissionUpdate; Relationships: [] };
      profile_roles: { Row: ProfileRoleRow; Insert: ProfileRoleInsert; Update: ProfileRoleUpdate; Relationships: [] };
      team_members: { Row: TeamMemberRow; Insert: TeamMemberInsert; Update: TeamMemberUpdate; Relationships: [] };
      leads: { Row: LeadRow; Insert: LeadInsert; Update: LeadUpdate; Relationships: [] };
      offers: { Row: OfferRow; Insert: OfferInsert; Update: OfferUpdate; Relationships: [] };
      calls: { Row: CallRow; Insert: CallInsert; Update: CallUpdate; Relationships: [] };
      call_analysis: { Row: CallAnalysisRow; Insert: CallAnalysisInsert; Update: CallAnalysisUpdate; Relationships: [] };
      invoices: { Row: InvoiceRow; Insert: InvoiceInsert; Update: InvoiceUpdate; Relationships: [] };
      phase_definitions: { Row: PhaseDefinitionRow; Insert: PhaseDefinitionInsert; Update: PhaseDefinitionUpdate; Relationships: [] };
      projects: { Row: ProjectRow; Insert: ProjectInsert; Update: ProjectUpdate; Relationships: [] };
      connectors: { Row: ConnectorRow; Insert: ConnectorInsert; Update: ConnectorUpdate; Relationships: [] };
      connector_sync_log: { Row: ConnectorSyncLogRow; Insert: ConnectorSyncLogInsert; Update: ConnectorSyncLogUpdate; Relationships: [] };
      kpi_snapshots: { Row: KpiSnapshotRow; Insert: KpiSnapshotInsert; Update: KpiSnapshotUpdate; Relationships: [] };
      cashflow_entries: { Row: CashflowEntryRow; Insert: CashflowEntryInsert; Update: CashflowEntryUpdate; Relationships: [] };
      calendar_events: { Row: CalendarEventRow; Insert: CalendarEventInsert; Update: CalendarEventUpdate; Relationships: [] };
      audit_log: { Row: AuditLogRow; Insert: AuditLogInsert; Update: AuditLogUpdate; Relationships: [] };
      holding_admins: { Row: HoldingAdminRow; Insert: HoldingAdminInsert; Update: HoldingAdminUpdate; Relationships: [] };
      payments: { Row: PaymentRow; Insert: PaymentInsert; Update: PaymentUpdate; Relationships: [] };
      offer_notes: { Row: OfferNoteRow; Insert: OfferNoteInsert; Update: OfferNoteUpdate; Relationships: [] };
      call_scripts: { Row: CallScriptRow; Insert: CallScriptInsert; Update: CallScriptUpdate; Relationships: [] };
      cashflow_uploads: { Row: CashflowUploadRow; Insert: CashflowUploadInsert; Update: CashflowUploadUpdate; Relationships: [] };
      project_phase_history: { Row: ProjectPhaseHistoryRow; Insert: ProjectPhaseHistoryInsert; Update: ProjectPhaseHistoryUpdate; Relationships: [] };
      daily_reports: { Row: DailyReportRow; Insert: DailyReportInsert; Update: DailyReportUpdate; Relationships: [] };
      company_settings: { Row: CompanySettingsRow; Insert: CompanySettingsInsert; Update: CompanySettingsUpdate; Relationships: [] };
      transcription_usage: { Row: TranscriptionUsageRow; Insert: TranscriptionUsageInsert; Update: TranscriptionUsageUpdate; Relationships: [] };
      anomalies: { Row: AnomalyRow; Insert: AnomalyInsert; Update: AnomalyUpdate; Relationships: [] };
      whatsapp_messages: { Row: WhatsAppMessageRow; Insert: WhatsAppMessageInsert; Update: WhatsAppMessageUpdate; Relationships: [] };
      email_activity: { Row: EmailActivityRow; Insert: EmailActivityInsert; Update: EmailActivityUpdate; Relationships: [] };
      holding_secrets: { Row: HoldingSecretRow; Insert: HoldingSecretInsert; Update: HoldingSecretUpdate; Relationships: [] };
      tool_registry: { Row: ToolRegistryRow; Insert: ToolRegistryInsert; Update: ToolRegistryUpdate; Relationships: [] };
      process_templates: { Row: ProcessTemplateRow; Insert: ProcessTemplateInsert; Update: ProcessTemplateUpdate; Relationships: [] };
      process_definitions: { Row: ProcessDefinitionRow; Insert: ProcessDefinitionInsert; Update: ProcessDefinitionUpdate; Relationships: [] };
      process_steps: { Row: ProcessStepRow; Insert: ProcessStepInsert; Update: ProcessStepUpdate; Relationships: [] };
      process_step_sources: { Row: ProcessStepSourceRow; Insert: ProcessStepSourceInsert; Update: ProcessStepSourceUpdate; Relationships: [] };
      process_step_interfaces: { Row: ProcessStepInterfaceRow; Insert: ProcessStepInterfaceInsert; Update: ProcessStepInterfaceUpdate; Relationships: [] };
      process_step_liquidity: { Row: ProcessStepLiquidityRow; Insert: ProcessStepLiquidityInsert; Update: ProcessStepLiquidityUpdate; Relationships: [] };
      process_versions: { Row: ProcessVersionRow; Insert: ProcessVersionInsert; Update: ProcessVersionUpdate; Relationships: [] };
      process_deployments: { Row: ProcessDeploymentRow; Insert: ProcessDeploymentInsert; Update: ProcessDeploymentUpdate; Relationships: [] };
      company_currency_settings: { Row: CompanyCurrencySettingsRow; Insert: CompanyCurrencySettingsInsert; Update: CompanyCurrencySettingsUpdate; Relationships: [] };
      compliance_rules: { Row: ComplianceRuleRow; Insert: ComplianceRuleInsert; Update: ComplianceRuleUpdate; Relationships: [] };
      compliance_checks: { Row: ComplianceCheckRow; Insert: ComplianceCheckInsert; Update: ComplianceCheckUpdate; Relationships: [] };
      compliance_documents: { Row: ComplianceDocumentRow; Insert: ComplianceDocumentInsert; Update: ComplianceDocumentUpdate; Relationships: [] };
      certifications: { Row: CertificationRow; Insert: CertificationInsert; Update: CertificationUpdate; Relationships: [] };
      project_process_instances: { Row: ProjectProcessInstanceRow; Insert: ProjectProcessInstanceInsert; Update: ProjectProcessInstanceUpdate; Relationships: [] };
      liquidity_event_instances: { Row: LiquidityEventInstanceRow; Insert: LiquidityEventInstanceInsert; Update: LiquidityEventInstanceUpdate; Relationships: [] };
      bank_upload_files: { Row: BankUploadFileRow; Insert: BankUploadFileInsert; Update: BankUploadFileUpdate; Relationships: [] };
      bank_transactions: { Row: BankTransactionRow; Insert: BankTransactionInsert; Update: BankTransactionUpdate; Relationships: [] };
      interface_execution_log: { Row: InterfaceExecutionLogRow; Insert: InterfaceExecutionLogInsert; Update: InterfaceExecutionLogUpdate; Relationships: [] };
      holding_subscriptions: { Row: HoldingSubscriptionRow; Insert: HoldingSubscriptionInsert; Update: HoldingSubscriptionUpdate; Relationships: [] };
      holding_onboarding: { Row: HoldingOnboardingRow; Insert: HoldingOnboardingInsert; Update: HoldingOnboardingUpdate; Relationships: [] };
      user_invitations: { Row: UserInvitationRow; Insert: UserInvitationInsert; Update: UserInvitationUpdate; Relationships: [] };
      platform_metrics: { Row: PlatformMetricRow; Insert: PlatformMetricInsert; Update: PlatformMetricUpdate; Relationships: [] };
      help_snippets: { Row: HelpSnippetRow; Insert: HelpSnippetInsert; Update: HelpSnippetUpdate; Relationships: [] };
      user_tour_progress: { Row: UserTourProgressRow; Insert: UserTourProgressInsert; Update: UserTourProgressUpdate; Relationships: [] };
      help_feedback: { Row: HelpFeedbackRow; Insert: HelpFeedbackInsert; Update: HelpFeedbackUpdate; Relationships: [] };
      company_feature_flags: { Row: CompanyFeatureFlagsRow; Insert: CompanyFeatureFlagsInsert; Update: CompanyFeatureFlagsUpdate; Relationships: [] };
      suppliers: { Row: SupplierRow; Insert: SupplierInsert; Update: SupplierUpdate; Relationships: [] };
      invoices_incoming: { Row: InvoiceIncomingRow; Insert: InvoiceIncomingInsert; Update: InvoiceIncomingUpdate; Relationships: [] };
      invoice_line_items: { Row: InvoiceLineItemRow; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      payment_runs: { Row: PaymentRunRow; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      payment_run_items: { Row: PaymentRunItemRow; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      cashout_residual_decisions: { Row: CashoutResidualDecisionRow; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      company_banking_config: { Row: CompanyBankingConfigRow; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      process_kpi_definitions: { Row: ProcessKpiDefinitionRow; Insert: ProcessKpiDefinitionInsert; Update: ProcessKpiDefinitionUpdate; Relationships: [] };
      process_kpi_values: { Row: ProcessKpiValueRow; Insert: ProcessKpiValueInsert; Update: Record<string, unknown>; Relationships: [] };
      process_phases: { Row: ProcessPhaseRow; Insert: ProcessPhaseInsert; Update: ProcessPhaseUpdate; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      tenant_status: TenantStatus;
      lead_status: LeadStatus;
      lead_source: LeadSource;
      offer_status: OfferStatus;
      call_direction: CallDirection;
      call_status: CallStatus;
      invoice_status: InvoiceStatus;
      project_status: ProjectStatus;
      connector_type: ConnectorType;
      connector_status: ConnectorStatus;
      sync_status: SyncStatus;
      cashflow_type: CashflowType;
      subscription_plan: SubscriptionPlan;
      billing_cycle: BillingCycle;
    };
    CompositeTypes: Record<string, never>;
  };
}