-- 036: Project documents table for attachments (photos, drawings, invoices, etc.)

CREATE TABLE IF NOT EXISTS public.project_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id       UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL CHECK (document_type IN (
    'voice_note', 'email', 'drawing', 'photo', 'video',
    'invoice_customer', 'invoice_supplier', 'contract', 'offer', 'report', 'other'
  )),
  title            TEXT NOT NULL,
  description      TEXT,
  storage_path     TEXT NOT NULL,
  filename         TEXT,
  mime_type        TEXT,
  file_size        INTEGER,
  uploaded_by      UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project
  ON public.project_documents (project_id, document_type);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enura_project_documents" ON public.project_documents FOR ALL
  USING (public.is_enura_admin());
CREATE POLICY "holding_project_documents" ON public.project_documents FOR ALL
  USING (holding_id = public.current_holding_id() AND public.is_holding_admin());
CREATE POLICY "company_project_documents" ON public.project_documents FOR ALL
  USING (company_id = public.current_company_id());
