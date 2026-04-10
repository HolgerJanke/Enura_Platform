-- ============================================================
-- Migration 011 — Introduce Holdings Layer
-- Adds the Holdings table and the Enura Group meta-level.
-- Safe to run on existing data — adds new structures only.
-- ============================================================

-- 1. Enura Group meta-level config (single row)
CREATE TABLE IF NOT EXISTS public.enura_platform (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL DEFAULT 'Enura Group',
  secret_management    TEXT NOT NULL DEFAULT 'holding_only',
  tool_registry        TEXT NOT NULL DEFAULT 'holding_only',
  template_management  TEXT NOT NULL DEFAULT 'holding_only',
  permission_matrix    TEXT NOT NULL DEFAULT 'holding_only',
  default_language     TEXT NOT NULL DEFAULT 'de',
  default_locale       TEXT NOT NULL DEFAULT 'de-CH',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.enura_platform (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 2. Holdings table
CREATE TABLE IF NOT EXISTS public.holdings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','suspended','archived')),
  branding         JSONB NOT NULL DEFAULT '{
    "primary": "#1A56DB", "secondary": "#1A1A1A", "accent": "#F3A917",
    "background": "#FFFFFF", "surface": "#F9FAFB",
    "textPrimary": "#111827", "textSecondary": "#6B7280",
    "font": "Inter", "fontUrl": null, "radius": "8px",
    "darkModeEnabled": true, "language": "de", "locale": "de-CH",
    "dateFormat": "DD.MM.YYYY", "numberFormat": "de-CH",
    "currencyDisplay": "CHF", "availableLanguages": ["de"],
    "fallbackLanguage": "de"
  }'::jsonb,
  primary_domain   TEXT,
  permission_matrix JSONB NOT NULL DEFAULT '{
    "process_create_structural": false,
    "process_edit_redactional": true,
    "process_deploy": false,
    "user_management": true
  }'::jsonb,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Domain mappings
CREATE TABLE IF NOT EXISTS public.domain_mappings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      TEXT NOT NULL UNIQUE,
  holding_id  UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id  UUID,
  ssl_status  TEXT NOT NULL DEFAULT 'pending'
                CHECK (ssl_status IN ('pending','active','error')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Holding admins v2 (tied to specific holdings)
CREATE TABLE IF NOT EXISTS public.holding_admins_v2 (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id  UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_owner    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (holding_id, profile_id)
);

-- 5. Enura Group super-admins
CREATE TABLE IF NOT EXISTS public.enura_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing holding_admins → enura_admins
INSERT INTO public.enura_admins (profile_id, created_at)
SELECT profile_id, created_at
FROM   public.holding_admins
ON CONFLICT (profile_id) DO NOTHING;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_holdings_slug       ON public.holdings (slug);
CREATE INDEX IF NOT EXISTS idx_holdings_status     ON public.holdings (status);
CREATE INDEX IF NOT EXISTS idx_domain_holding      ON public.domain_mappings (holding_id);
CREATE INDEX IF NOT EXISTS idx_holding_admins_v2   ON public.holding_admins_v2 (holding_id, profile_id);
