-- =============================================================================
-- Migration 020: Platform Admin — Holding Onboarding & White-Label
-- Phase 11: Subscription management, onboarding wizard, user invitations,
--           and platform-wide metrics for the Enura admin dashboard.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. holding_subscriptions
-- =============================================================================

CREATE TABLE IF NOT EXISTS holding_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id    UUID NOT NULL UNIQUE REFERENCES holdings(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL DEFAULT 'professional'
                  CHECK (plan IN ('starter', 'professional', 'scale', 'enterprise')),
  company_plan  TEXT NOT NULL DEFAULT 'professional'
                  CHECK (company_plan IN ('starter', 'professional', 'scale', 'enterprise')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (billing_cycle IN ('monthly', 'annual')),
  ai_calls_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  process_builder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  liquidity_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  max_companies           INTEGER NOT NULL DEFAULT 10,
  max_users_per_company   INTEGER NOT NULL DEFAULT 30,
  trial_ends_at           DATE,
  activated_at            TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE holding_subscriptions IS 'One subscription per holding — controls plan features, limits, and billing.';

-- =============================================================================
-- 2. holding_onboarding
-- =============================================================================

CREATE TABLE IF NOT EXISTS holding_onboarding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id      UUID NOT NULL UNIQUE REFERENCES holdings(id) ON DELETE CASCADE,
  current_step    INTEGER NOT NULL DEFAULT 1,
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  wizard_data     JSONB NOT NULL DEFAULT '{}',
  is_complete     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE holding_onboarding IS 'Tracks onboarding wizard progress for each holding.';

-- =============================================================================
-- 3. user_invitations
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id  UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role_name   TEXT NOT NULL,
  invited_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  token       TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_invitations IS 'Invitation tokens for onboarding new users into a holding or company.';

-- Partial index: only non-accepted, non-revoked tokens are looked up
CREATE INDEX idx_user_invitations_token_active
  ON user_invitations (token)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Fast lookup of invitations by email within a holding
CREATE INDEX idx_user_invitations_email_holding
  ON user_invitations (email, holding_id);

-- =============================================================================
-- 4. platform_metrics
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_metrics (
  id                BIGSERIAL PRIMARY KEY,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_holdings    INTEGER NOT NULL DEFAULT 0,
  active_holdings   INTEGER NOT NULL DEFAULT 0,
  total_companies   INTEGER NOT NULL DEFAULT 0,
  total_users       INTEGER NOT NULL DEFAULT 0,
  ai_calls_24h     INTEGER NOT NULL DEFAULT 0,
  deployments_24h   INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE platform_metrics IS 'Time-series snapshots of platform-wide metrics for the Enura admin dashboard.';

CREATE INDEX idx_platform_metrics_measured_at
  ON platform_metrics (measured_at DESC);

-- =============================================================================
-- 5. Trigger: auto-create holding_subscriptions on holdings INSERT
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_auto_create_holding_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO holding_subscriptions (holding_id)
  VALUES (NEW.id)
  ON CONFLICT (holding_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_holding_subscription ON holdings;
CREATE TRIGGER trg_auto_create_holding_subscription
  AFTER INSERT ON holdings
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_holding_subscription();

-- =============================================================================
-- 6. updated_at triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_holding_subscriptions_updated_at
  BEFORE UPDATE ON holding_subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_holding_onboarding_updated_at
  BEFORE UPDATE ON holding_onboarding
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- 7. Row-Level Security
-- =============================================================================

-- ---- holding_subscriptions ----
ALTER TABLE holding_subscriptions ENABLE ROW LEVEL SECURITY;

-- Enura admins: full access
CREATE POLICY holding_subscriptions_enura_all
  ON holding_subscriptions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- Holding admins: read own
CREATE POLICY holding_subscriptions_holding_read
  ON holding_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = holding_subscriptions.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  );

-- ---- holding_onboarding ----
ALTER TABLE holding_onboarding ENABLE ROW LEVEL SECURITY;

-- Enura admins: full access
CREATE POLICY holding_onboarding_enura_all
  ON holding_onboarding
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- Holding admins: full access to own
CREATE POLICY holding_onboarding_holding_all
  ON holding_onboarding
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = holding_onboarding.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = holding_onboarding.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  );

-- ---- user_invitations ----
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Enura admins: full access
CREATE POLICY user_invitations_enura_all
  ON user_invitations
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

-- Holding admins: full access to own holding's invitations
CREATE POLICY user_invitations_holding_all
  ON user_invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = user_invitations.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM holding_admins_v2
      WHERE holding_admins_v2.holding_id = user_invitations.holding_id
        AND holding_admins_v2.profile_id = auth.uid()
    )
  );

-- Public (anon/authenticated): read a single invitation by valid, unexpired token
CREATE POLICY user_invitations_token_read
  ON user_invitations
  FOR SELECT
  USING (
    accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  );

-- ---- platform_metrics ----
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

-- Enura admins only
CREATE POLICY platform_metrics_enura_all
  ON platform_metrics
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM enura_admins WHERE profile_id = auth.uid())
  );

COMMIT;
