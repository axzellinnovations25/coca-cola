-- A collection review is an acknowledgement only. It does not approve, alter,
-- or reverse the payment.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_reviewed_at
  ON payments (reviewed_at);

COMMENT ON COLUMN payments.reviewed_at IS
  'When an admin marked this collection as seen/reviewed; does not affect payment status or totals.';

COMMENT ON COLUMN payments.reviewed_by IS
  'User ID of the admin who most recently marked this collection as reviewed.';
