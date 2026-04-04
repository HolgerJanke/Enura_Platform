-- =============================================================================
-- Migration 021: Manual / Help System
-- Phase 13: Contextual help snippets, guided tours, help feedback.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. help_snippets — contextual tooltips / inline help per locale
-- =============================================================================

CREATE TABLE IF NOT EXISTS help_snippets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key  TEXT NOT NULL,
  locale        TEXT NOT NULL CHECK (locale IN ('de', 'en', 'fr', 'it')),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  article_slug  TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (location_key, locale)
);

CREATE INDEX idx_help_snippets_location ON help_snippets(location_key);

-- =============================================================================
-- 2. user_tour_progress — tracks onboarding / guided tour completion
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_tour_progress (
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tour_id       TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  last_step     INTEGER NOT NULL DEFAULT 0,
  skipped       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (profile_id, tour_id)
);

-- =============================================================================
-- 3. help_feedback — user feedback on help articles
-- =============================================================================

CREATE TABLE IF NOT EXISTS help_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug  TEXT NOT NULL,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  locale        TEXT NOT NULL CHECK (locale IN ('de', 'en', 'fr', 'it')),
  helpful       BOOLEAN NOT NULL,
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_help_feedback_article ON help_feedback(article_slug);

-- =============================================================================
-- 4. RLS Policies
-- =============================================================================

ALTER TABLE help_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tour_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_feedback ENABLE ROW LEVEL SECURITY;

-- help_snippets: readable by all authenticated, writable by enura admins
CREATE POLICY "help_snippets_select_authenticated"
  ON help_snippets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "help_snippets_insert_enura_admin"
  ON help_snippets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

CREATE POLICY "help_snippets_update_enura_admin"
  ON help_snippets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

CREATE POLICY "help_snippets_delete_enura_admin"
  ON help_snippets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- user_tour_progress: users manage own rows
CREATE POLICY "tour_progress_select_own"
  ON user_tour_progress FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "tour_progress_insert_own"
  ON user_tour_progress FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "tour_progress_update_own"
  ON user_tour_progress FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "tour_progress_delete_own"
  ON user_tour_progress FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- help_feedback: users write own, enura admins read all
CREATE POLICY "help_feedback_select_own"
  ON help_feedback FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

CREATE POLICY "help_feedback_insert_own"
  ON help_feedback FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- =============================================================================
-- 5. Seed ~15 German contextual snippets
-- =============================================================================

INSERT INTO help_snippets (id, location_key, locale, title, content, article_slug)
VALUES
  (gen_random_uuid(), 'settings.secrets.api_key', 'de',
   'API-Schlüssel',
   'Der API-Schlüssel authentifiziert die Verbindung zu externen Diensten. Bewahren Sie ihn sicher auf und teilen Sie ihn nie in öffentlichen Kanälen. Nach dem Speichern wird der Schlüssel verschlüsselt abgelegt und ist nicht mehr im Klartext abrufbar.',
   'secrets-management'),

  (gen_random_uuid(), 'settings.secrets.oauth_token', 'de',
   'OAuth-Token',
   'OAuth-Tokens ermöglichen den Zugriff auf Drittanbieter-APIs im Namen Ihres Unternehmens. Tokens laufen regelmässig ab und werden automatisch erneuert. Sollte die Erneuerung fehlschlagen, müssen Sie die Verbindung erneut autorisieren.',
   'secrets-management'),

  (gen_random_uuid(), 'settings.secrets.encryption', 'de',
   'Verschlüsselung von Geheimnissen',
   'Alle Credentials werden mit AES-256-GCM verschlüsselt in der Datenbank gespeichert. Der Verschlüsselungsschlüssel liegt in Supabase Vault und ist für die Applikationsebene nicht einsehbar.',
   'secrets-management'),

  (gen_random_uuid(), 'process_builder.overview', 'de',
   'Prozess-Builder Übersicht',
   'Der Prozess-Builder ermöglicht die visuelle Definition von Geschäftsprozessen. Erstellen Sie Schritte, definieren Sie Datenquellen und verknüpfen Sie Schnittstellen. Jeder Prozess durchläuft Versionierung und kann pro Unternehmen bereitgestellt werden.',
   'process-builder'),

  (gen_random_uuid(), 'process_builder.step_config', 'de',
   'Schritt-Konfiguration',
   'Jeder Prozessschritt kann Datenquellen, Schnittstellen und Liquiditätsereignisse enthalten. Die Reihenfolge bestimmt den Ablauf. Verwenden Sie die Drag-and-Drop-Funktion, um Schritte neu zu ordnen.',
   'process-builder'),

  (gen_random_uuid(), 'process_builder.versioning', 'de',
   'Prozess-Versionierung',
   'Änderungen an einem Prozess erstellen automatisch eine neue Version. Nur veröffentlichte Versionen können bereitgestellt werden. Ältere Versionen bleiben als Referenz erhalten.',
   'process-builder'),

  (gen_random_uuid(), 'process_builder.deployment', 'de',
   'Prozess-Bereitstellung',
   'Nach der Veröffentlichung können Sie einen Prozess für einzelne Unternehmen bereitstellen. Pro Unternehmen ist nur eine aktive Bereitstellung möglich. Bei Problemen können Sie auf eine frühere Version zurückrollen.',
   'process-builder'),

  (gen_random_uuid(), 'liquidity.forecast', 'de',
   'Liquiditätsprognose',
   'Die 30/60/90-Tage-Prognose berechnet sich aus offenen Rechnungen, geplanten Zahlungen und historischen Cashflow-Daten. Die Warngrenze wird pro Unternehmen konfiguriert — unterschreitet die Prognose diesen Wert, wird eine Benachrichtigung ausgelöst.',
   'liquidity-forecast'),

  (gen_random_uuid(), 'liquidity.cashflow_upload', 'de',
   'Cashflow-Upload',
   'Laden Sie monatliche Cashflow-Daten als Excel-Datei hoch. Die Datei muss die Spalten Datum, Kategorie, Betrag und Beschreibung enthalten. Ungültige Zeilen werden übersprungen und im Fehlerbericht aufgeführt.',
   'cashflow-upload'),

  (gen_random_uuid(), 'liquidity.bank_transactions', 'de',
   'Banktransaktionen',
   'Importierte Banktransaktionen werden automatisch mit offenen Rechnungen abgeglichen. Bei Mehrdeutigkeiten wird ein manueller Abgleich vorgeschlagen. Die Zuordnung beeinflusst direkt die Liquiditätsberechnung.',
   'bank-transactions'),

  (gen_random_uuid(), 'permissions.role_overview', 'de',
   'Rollen-Übersicht',
   'Jede Rolle definiert, welche Module und Aktionen ein Benutzer ausführen darf. Rollen werden pro Unternehmen zugewiesen. Ein Benutzer kann mehrere Rollen haben — die Berechtigungen werden vereinigt (Union).',
   'role-permissions'),

  (gen_random_uuid(), 'permissions.module_access', 'de',
   'Modul-Zugriff',
   'Berechtigungen folgen dem Schema module:{modul}:{aktion}. Aktionen sind: read, write, export, admin. Ohne explizite Berechtigung ist der Zugriff standardmässig verweigert (Deny by Default).',
   'role-permissions'),

  (gen_random_uuid(), 'permissions.holding_admin', 'de',
   'Holding-Administrator',
   'Holding-Administratoren haben Zugriff auf alle Unternehmen der Holding. Sie sind keine Mandantenbenutzer und besitzen keine company_id. Ihre Aktionen werden im Audit-Log protokolliert.',
   'role-permissions'),

  (gen_random_uuid(), 'connector.health_status', 'de',
   'Connector-Status',
   'Der Status zeigt den Zustand jeder Datenverbindung. Grün = letzte Synchronisation erfolgreich. Gelb = Warnung (z. B. Teilfehler). Rot = Fehler nach 3 fehlgeschlagenen Versuchen. Prüfen Sie die Fehlermeldung und die Zugangsdaten.',
   'connector-health'),

  (gen_random_uuid(), 'kanban.phase_stall', 'de',
   'Phasen-Stagnation',
   'Projekte, die länger als der konfigurierte Schwellenwert in einer Phase verweilen, werden als "stagnierend" markiert. Der Schwellenwert wird pro Phase in den Phasendefinitionen festgelegt und kann jederzeit angepasst werden.',
   'kanban-phases')

ON CONFLICT (location_key, locale) DO UPDATE SET
  title        = EXCLUDED.title,
  content      = EXCLUDED.content,
  article_slug = EXCLUDED.article_slug,
  updated_at   = now();

COMMIT;
