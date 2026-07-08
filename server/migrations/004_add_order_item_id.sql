CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS id TEXT;

UPDATE order_items
SET id = gen_random_uuid()::text
WHERE id IS NULL;

ALTER TABLE order_items
ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_pkey'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
