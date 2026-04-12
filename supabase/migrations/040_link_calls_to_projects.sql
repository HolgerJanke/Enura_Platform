-- 040: Link calls and calendar_events to projects/leads
-- Enables project-level communication tracking for Setter and Berater tabs

BEGIN;

-- 1. Add project_id and lead_id to calls
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

CREATE INDEX IF NOT EXISTS idx_calls_project ON public.calls (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_lead ON public.calls (lead_id)
  WHERE lead_id IS NOT NULL;

-- 2. Add project_id and lead_id to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON public.calendar_events (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead ON public.calendar_events (lead_id)
  WHERE lead_id IS NOT NULL;

-- 3. Backfill: Match calls to leads via phone number, then to projects via lead_id
UPDATE public.calls c
SET lead_id = l.id,
    project_id = p.id
FROM public.leads l
LEFT JOIN public.projects p ON p.lead_id = l.id AND p.company_id = l.company_id
WHERE (c.caller_number = l.phone OR c.callee_number = l.phone)
  AND c.company_id = l.company_id
  AND c.lead_id IS NULL
  AND l.phone IS NOT NULL
  AND l.phone != '';

-- 4. Backfill: Match calendar_events to leads/projects via team_member_id
-- Calendar events don't have phone numbers, so match via the berater/setter assignment
UPDATE public.calendar_events ce
SET project_id = p.id,
    lead_id = p.lead_id
FROM public.projects p
WHERE p.berater_id = ce.team_member_id
  AND p.company_id = ce.company_id
  AND p.status = 'active'
  AND ce.project_id IS NULL;

COMMIT;
