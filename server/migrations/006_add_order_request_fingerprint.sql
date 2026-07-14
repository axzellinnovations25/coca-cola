-- Enables backend-only retry deduplication for installed app versions that do
-- not send an idempotency key. The server computes a canonical fingerprint
-- from the representative, shop, notes, and order items.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_recent_request_fingerprint
  ON orders (shop_id, sales_rep_id, request_fingerprint, created_at DESC)
  WHERE request_fingerprint IS NOT NULL;

  
