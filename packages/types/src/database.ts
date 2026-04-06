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
// TABLE: tenants
// =============================================================================

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantInsert {
  id?: string;
  slug: string;
  name: string;
  status?: TenantStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TenantUpdate {
  id?: string;
  slug?: string;
  name?: string;
  status?: TenantStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: tenant_brandings
// =============================================================================

export interface TenantBrandingRow {
  id: string;
  tenant_id: string;
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

export interface TenantBrandingInsert {
  id?: string;
  tenant_id: string;
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

export interface TenantBrandingUpdate {
  id?: string;
  tenant_id?: string;
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
  tenant_id: string | null;
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
  tenant_id?: string | null;
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
  tenant_id?: string | null;
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
  tenant_id: string | null;
  key: string;
  label: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleInsert {
  id?: string;
  tenant_id?: string | null;
  key: string;
  label: string;
  description?: string | null;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RoleUpdate {
  id?: string;
  tenant_id?: string | null;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
  offer_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
}

export interface OfferNoteInsert {
  id?: string;
  tenant_id: string;
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
  tenant_id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallScriptInsert {
  id?: string;
  tenant_id: string;
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
  tenant_id: string;
  filename: string;
  uploaded_by: string | null;
  row_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface CashflowUploadInsert {
  id?: string;
  tenant_id: string;
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
  tenant_id: string;
  from_phase: number | null;
  to_phase: number;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface ProjectPhaseHistoryInsert {
  id?: string;
  project_id: string;
  tenant_id: string;
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
  tenant_id: string;
  phase_number: number;
  name: string;
  description: string | null;
  color: string | null;
  stall_threshold_days: number | null;
  created_at: string;
}

export interface PhaseDefinitionInsert {
  id?: string;
  tenant_id: string;
  phase_number: number;
  name: string;
  description?: string | null;
  color?: string | null;
  stall_threshold_days?: number | null;
  created_at?: string;
}

export interface PhaseDefinitionUpdate {
  id?: string;
  tenant_id?: string;
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
  tenant_id: string;
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
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectInsert {
  id?: string;
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
  snapshot_type: string;
  entity_id: string | null;
  period_date: string;
  metrics: Record<string, unknown>;
  created_at: string;
}

export interface KpiSnapshotInsert {
  id?: string;
  tenant_id: string;
  snapshot_type: string;
  entity_id?: string | null;
  period_date: string;
  metrics?: Record<string, unknown>;
  created_at?: string;
}

export interface KpiSnapshotUpdate {
  id?: string;
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string | null;
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
  tenant_id?: string | null;
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
  tenant_id?: string | null;
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
  tenant_id: string;
  report_date: string;
  report_json: Record<string, unknown>;
  kpi_data: Record<string, unknown>;
  sent_to: string[];
  sent_at: string;
}

export interface DailyReportInsert {
  id?: string;
  tenant_id: string;
  report_date: string;
  report_json: Record<string, unknown>;
  kpi_data: Record<string, unknown>;
  sent_to?: string[];
  sent_at?: string;
}

export interface DailyReportUpdate {
  id?: string;
  tenant_id?: string;
  report_date?: string;
  report_json?: Record<string, unknown>;
  kpi_data?: Record<string, unknown>;
  sent_to?: string[];
  sent_at?: string;
}

// =============================================================================
// TABLE: tenant_settings
// =============================================================================

export interface TenantSettingsRow {
  tenant_id: string;
  report_send_time: string;
  report_timezone: string;
  report_recipients_all: boolean;
  stalled_project_days: number;
  unworked_lead_hours: number;
  max_whisper_usd_monthly: string;
  updated_at: string;
}

export interface TenantSettingsInsert {
  tenant_id: string;
  report_send_time?: string;
  report_timezone?: string;
  report_recipients_all?: boolean;
  stalled_project_days?: number;
  unworked_lead_hours?: number;
  max_whisper_usd_monthly?: string;
  updated_at?: string;
}

export interface TenantSettingsUpdate {
  tenant_id?: string;
  report_send_time?: string;
  report_timezone?: string;
  report_recipients_all?: boolean;
  stalled_project_days?: number;
  unworked_lead_hours?: number;
  max_whisper_usd_monthly?: string;
  updated_at?: string;
}

// =============================================================================
// TABLE: transcription_usage
// =============================================================================

export interface TranscriptionUsageRow {
  id: string;
  tenant_id: string;
  month: string;
  total_minutes: string;
  estimated_usd: string;
  updated_at: string;
}

export interface TranscriptionUsageInsert {
  id?: string;
  tenant_id: string;
  month: string;
  total_minutes?: string;
  estimated_usd?: string;
  updated_at?: string;
}

export interface TranscriptionUsageUpdate {
  id?: string;
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id?: string;
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
  tenant_id: string;
  team_member_id: string;
  activity_date: string;
  emails_sent: number;
  created_at: string;
  updated_at: string;
}

export interface EmailActivityInsert {
  id?: string;
  tenant_id: string;
  team_member_id: string;
  activity_date: string;
  emails_sent?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmailActivityUpdate {
  id?: string;
  tenant_id?: string;
  team_member_id?: string;
  activity_date?: string;
  emails_sent?: number;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// Supabase JS Client Compatible Database Type
// =============================================================================

export interface Database {
  public: {
    Tables: {
      tenants: { Row: TenantRow; Insert: TenantInsert; Update: TenantUpdate; Relationships: [] };
      tenant_brandings: { Row: TenantBrandingRow; Insert: TenantBrandingInsert; Update: TenantBrandingUpdate; Relationships: [] };
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
      tenant_settings: { Row: TenantSettingsRow; Insert: TenantSettingsInsert; Update: TenantSettingsUpdate; Relationships: [] };
      transcription_usage: { Row: TranscriptionUsageRow; Insert: TranscriptionUsageInsert; Update: TranscriptionUsageUpdate; Relationships: [] };
      anomalies: { Row: AnomalyRow; Insert: AnomalyInsert; Update: AnomalyUpdate; Relationships: [] };
      whatsapp_messages: { Row: WhatsAppMessageRow; Insert: WhatsAppMessageInsert; Update: WhatsAppMessageUpdate; Relationships: [] };
      email_activity: { Row: EmailActivityRow; Insert: EmailActivityInsert; Update: EmailActivityUpdate; Relationships: [] };
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
    };
    CompositeTypes: Record<string, never>;
  };
}
