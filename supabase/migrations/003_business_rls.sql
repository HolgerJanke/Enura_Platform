-- =============================================================================
-- Migration 003: Fine-Grained Business RLS Policies
-- Enura Group Multi-Tenant BI Platform
--
-- Contains: Holding admin full-override policies for all business tables,
--           permission-gated finance policies, AI/call analysis permission gates.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. Drop Any Conflicting Policies From Previous Migrations
--    (schema.sql had basic policies that may conflict with the new ones)
-- =============================================================================

-- Drop old schema.sql-style policies that might exist on these tables
-- (from schema.sql direct application, NOT from 001 or 002)
DROP POLICY IF EXISTS leads_select ON leads;
DROP POLICY IF EXISTS leads_insert ON leads;
DROP POLICY IF EXISTS leads_update ON leads;
DROP POLICY IF EXISTS offers_select ON offers;
DROP POLICY IF EXISTS offers_insert ON offers;
DROP POLICY IF EXISTS offers_update ON offers;
DROP POLICY IF EXISTS calls_select ON calls;
DROP POLICY IF EXISTS call_analysis_select ON call_analysis;
DROP POLICY IF EXISTS invoices_select ON invoices;
DROP POLICY IF EXISTS invoices_insert ON invoices;
DROP POLICY IF EXISTS projects_select ON projects;
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS team_members_select ON team_members;
DROP POLICY IF EXISTS phase_definitions_select ON phase_definitions;
DROP POLICY IF EXISTS connectors_select ON connectors;
DROP POLICY IF EXISTS kpi_snapshots_select ON kpi_snapshots;
DROP POLICY IF EXISTS cashflow_entries_select ON cashflow_entries;
DROP POLICY IF EXISTS calendar_events_select ON calendar_events;
DROP POLICY IF EXISTS connector_sync_log_select ON connector_sync_log;

-- =============================================================================
-- 2. Holding Admin Full Override Policies (FOR ALL = SELECT, INSERT, UPDATE, DELETE)
--    Holding admins can do anything on all business tables.
-- =============================================================================

-- ---- leads ----
DROP POLICY IF EXISTS holding_override_leads ON leads;
CREATE POLICY holding_override_leads ON leads FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- offers ----
DROP POLICY IF EXISTS holding_override_offers ON offers;
CREATE POLICY holding_override_offers ON offers FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- calls ----
DROP POLICY IF EXISTS holding_override_calls ON calls;
CREATE POLICY holding_override_calls ON calls FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- call_analysis ----
DROP POLICY IF EXISTS holding_override_call_analysis ON call_analysis;
CREATE POLICY holding_override_call_analysis ON call_analysis FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- invoices ----
DROP POLICY IF EXISTS holding_override_invoices ON invoices;
CREATE POLICY holding_override_invoices ON invoices FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- payments ----
DROP POLICY IF EXISTS holding_override_payments ON payments;
CREATE POLICY holding_override_payments ON payments FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- projects ----
DROP POLICY IF EXISTS holding_override_projects ON projects;
CREATE POLICY holding_override_projects ON projects FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- project_phase_history ----
DROP POLICY IF EXISTS holding_override_project_phase_history ON project_phase_history;
CREATE POLICY holding_override_project_phase_history ON project_phase_history FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- calendar_events ----
DROP POLICY IF EXISTS holding_override_calendar_events ON calendar_events;
CREATE POLICY holding_override_calendar_events ON calendar_events FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- team_members ----
DROP POLICY IF EXISTS holding_override_team_members ON team_members;
CREATE POLICY holding_override_team_members ON team_members FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- connectors ----
DROP POLICY IF EXISTS holding_override_connectors ON connectors;
CREATE POLICY holding_override_connectors ON connectors FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- cashflow_entries ----
DROP POLICY IF EXISTS holding_override_cashflow_entries ON cashflow_entries;
CREATE POLICY holding_override_cashflow_entries ON cashflow_entries FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- cashflow_uploads ----
DROP POLICY IF EXISTS holding_override_cashflow_uploads ON cashflow_uploads;
CREATE POLICY holding_override_cashflow_uploads ON cashflow_uploads FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- kpi_snapshots ----
DROP POLICY IF EXISTS holding_override_kpi_snapshots ON kpi_snapshots;
CREATE POLICY holding_override_kpi_snapshots ON kpi_snapshots FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- offer_notes ----
DROP POLICY IF EXISTS holding_override_offer_notes ON offer_notes;
CREATE POLICY holding_override_offer_notes ON offer_notes FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- call_scripts ----
DROP POLICY IF EXISTS holding_override_call_scripts ON call_scripts;
CREATE POLICY holding_override_call_scripts ON call_scripts FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- connector_sync_log ----
DROP POLICY IF EXISTS holding_override_connector_sync_log ON connector_sync_log;
CREATE POLICY holding_override_connector_sync_log ON connector_sync_log FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- ---- phase_definitions ----
DROP POLICY IF EXISTS holding_override_phase_definitions ON phase_definitions;
CREATE POLICY holding_override_phase_definitions ON phase_definitions FOR ALL
    USING (is_holding_admin()) WITH CHECK (is_holding_admin());

-- =============================================================================
-- 3. Finance Table Permission-Gated Policies
--    SELECT on finance tables requires module:finance:read permission.
--    These replace the basic tenant_select policies from 002 for finance tables.
-- =============================================================================

-- ---- invoices: permission-gated SELECT ----
DROP POLICY IF EXISTS invoices_tenant_select ON invoices;
CREATE POLICY invoices_tenant_select ON invoices FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- ---- payments: permission-gated SELECT ----
DROP POLICY IF EXISTS payments_tenant_select ON payments;
CREATE POLICY payments_tenant_select ON payments FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- ---- cashflow_entries: permission-gated SELECT ----
DROP POLICY IF EXISTS cashflow_entries_tenant_select ON cashflow_entries;
CREATE POLICY cashflow_entries_tenant_select ON cashflow_entries FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- ---- cashflow_uploads: permission-gated SELECT ----
DROP POLICY IF EXISTS cashflow_uploads_tenant_select ON cashflow_uploads;
CREATE POLICY cashflow_uploads_tenant_select ON cashflow_uploads FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:finance:read')
);

-- =============================================================================
-- 4. AI / Call Analysis Permission-Gated Policy
--    SELECT on call_analysis requires module:ai:read permission.
-- =============================================================================

-- Replace the basic tenant_select with a permission-gated version
DROP POLICY IF EXISTS call_analysis_tenant_select ON call_analysis;
CREATE POLICY call_analysis_tenant_select ON call_analysis FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:ai:read')
);

-- =============================================================================
-- 5. Connector Admin-Gated Policies
--    Connectors are only visible to users with module:admin:read permission.
-- =============================================================================

-- Replace basic connector select with admin-gated version
DROP POLICY IF EXISTS connectors_tenant_select ON connectors;
CREATE POLICY connectors_tenant_select ON connectors FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:admin:read')
);

-- Connector insert/update require admin:write
DROP POLICY IF EXISTS connectors_tenant_insert ON connectors;
CREATE POLICY connectors_tenant_insert ON connectors FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_permission('module:admin:write')
);

DROP POLICY IF EXISTS connectors_tenant_update ON connectors;
CREATE POLICY connectors_tenant_update ON connectors FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_permission('module:admin:write')
);

-- Connector sync logs also require admin:read
DROP POLICY IF EXISTS connector_sync_log_tenant_select ON connector_sync_log;
CREATE POLICY connector_sync_log_tenant_select ON connector_sync_log FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_permission('module:admin:read')
);

-- =============================================================================
-- End of Migration 003
-- =============================================================================
