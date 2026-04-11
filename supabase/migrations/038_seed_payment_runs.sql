-- 038: Seed payment runs from existing invoices with status 'in_payment_run'
-- Groups invoices by company and creates one payment run per company.

DO $$
DECLARE
  rec RECORD;
  run_id UUID;
  admin_id UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT i.company_id, i.holding_id
    FROM public.invoices_incoming i
    WHERE i.status = 'in_payment_run'
  LOOP
    -- Pick any profile in this company as the creator
    SELECT p.id INTO admin_id
    FROM public.profiles p
    WHERE p.company_id = rec.company_id
    LIMIT 1;

    IF admin_id IS NULL THEN CONTINUE; END IF;

    run_id := gen_random_uuid();

    INSERT INTO public.payment_runs (
      id, holding_id, company_id, run_date, name,
      created_by, total_amount, item_count, currency, status,
      submitted_at, submitted_by
    )
    SELECT
      run_id,
      rec.holding_id,
      rec.company_id,
      CURRENT_DATE,
      'Zahlungslauf ' || TO_CHAR(CURRENT_DATE, 'DD.MM.YYYY'),
      admin_id,
      COALESCE(SUM(i.gross_amount), 0),
      COUNT(*)::INTEGER,
      'CHF',
      'submitted',
      NOW(),
      admin_id
    FROM public.invoices_incoming i
    WHERE i.company_id = rec.company_id
      AND i.status = 'in_payment_run';

    -- Create payment run items
    INSERT INTO public.payment_run_items (
      run_id, holding_id, company_id, invoice_id,
      creditor_name, creditor_iban, amount, currency, sort_order
    )
    SELECT
      run_id,
      rec.holding_id,
      rec.company_id,
      i.id,
      COALESCE(i.sender_name, 'Unbekannt'),
      'CH00 0000 0000 0000 0000 0',
      COALESCE(i.gross_amount, 0),
      COALESCE(i.currency, 'CHF'),
      ROW_NUMBER() OVER (ORDER BY i.due_date)::INTEGER
    FROM public.invoices_incoming i
    WHERE i.company_id = rec.company_id
      AND i.status = 'in_payment_run';
  END LOOP;
END $$;
