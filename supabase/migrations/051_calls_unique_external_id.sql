-- 051_calls_unique_external_id.sql
-- Add unique constraint on (company_id, external_id) to calls table
-- so the 3CX connector can upsert call records.

BEGIN;

DROP INDEX IF EXISTS idx_calls_external;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_company_external
  ON calls (company_id, external_id);

COMMIT;
