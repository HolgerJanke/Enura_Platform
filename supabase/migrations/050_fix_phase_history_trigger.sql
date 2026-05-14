-- 050_fix_phase_history_trigger.sql
-- Fix: log_phase_transition trigger uses old column name tenant_id
-- instead of company_id (renamed in migration 012).

BEGIN;

CREATE OR REPLACE FUNCTION public.log_phase_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_phase IS DISTINCT FROM NEW.current_phase THEN
        INSERT INTO project_phase_history (project_id, company_id, holding_id, from_phase, to_phase, changed_by)
        VALUES (
            NEW.id,
            NEW.company_id,
            NEW.holding_id,
            OLD.current_phase,
            NEW.current_phase,
            auth.uid()
        );
        NEW.phase_entered_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
