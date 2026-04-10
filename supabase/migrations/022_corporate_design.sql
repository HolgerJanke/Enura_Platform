-- Add extended tokens and custom CSS support to company_branding
ALTER TABLE public.company_branding
  ADD COLUMN IF NOT EXISTS extended_tokens JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_css_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_css_updated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_css_uploaded_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Index for quick lookup of companies with custom CSS
CREATE INDEX IF NOT EXISTS idx_company_branding_custom_css
  ON public.company_branding (company_id) WHERE custom_css_path IS NOT NULL;
