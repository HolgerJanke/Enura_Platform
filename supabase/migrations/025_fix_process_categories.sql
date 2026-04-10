-- 025_fix_process_categories.sql
-- Align process_templates and process_definitions category CHECK constraints
-- to the German values used throughout the application code.

-- process_templates: drop old CHECK and add new one
ALTER TABLE public.process_templates
  DROP CONSTRAINT IF EXISTS process_templates_category_check;

ALTER TABLE public.process_templates
  ADD CONSTRAINT process_templates_category_check
  CHECK (category IN ('verkauf','planung','abwicklung','betrieb','sonstige'));

-- process_definitions: drop old CHECK and add new one
ALTER TABLE public.process_definitions
  DROP CONSTRAINT IF EXISTS process_definitions_category_check;

ALTER TABLE public.process_definitions
  ADD CONSTRAINT process_definitions_category_check
  CHECK (category IN ('verkauf','planung','abwicklung','betrieb','sonstige'));
