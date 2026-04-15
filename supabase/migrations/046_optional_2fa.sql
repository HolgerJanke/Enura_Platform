-- 046_optional_2fa.sql
-- Make 2FA optional per company (default: optional)

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE;
