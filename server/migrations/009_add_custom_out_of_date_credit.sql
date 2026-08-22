-- Allow an admin to choose the credit applied by each out-of-date document.
-- Existing documents retain the previous 40% credit so historical balances do
-- not change when this migration is deployed.
ALTER TABLE out_of_date
  ADD COLUMN IF NOT EXISTS credit_amount NUMERIC;

UPDATE out_of_date od
SET credit_amount = COALESCE((
  SELECT SUM(odi.line_total::numeric) * 0.4
  FROM out_of_date_items odi
  WHERE odi.out_of_date_id = od.id
), 0)
WHERE od.credit_amount IS NULL;

ALTER TABLE out_of_date
  ALTER COLUMN credit_amount SET DEFAULT 0,
  ALTER COLUMN credit_amount SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'out_of_date_credit_amount_nonnegative'
      AND conrelid = 'out_of_date'::regclass
  ) THEN
    ALTER TABLE out_of_date
      ADD CONSTRAINT out_of_date_credit_amount_nonnegative
      CHECK (credit_amount >= 0);
  END IF;
END $$;

COMMENT ON COLUMN out_of_date.credit_amount IS
  'Admin-selected credit applied to the invoice for this out-of-date document.';
