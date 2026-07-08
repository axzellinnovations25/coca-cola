CREATE TABLE IF NOT EXISTS out_of_date (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_out_of_date_order_id ON out_of_date(order_id);
CREATE INDEX IF NOT EXISTS idx_out_of_date_shop_id ON out_of_date(shop_id);

CREATE TABLE IF NOT EXISTS out_of_date_items (
  id TEXT PRIMARY KEY,
  out_of_date_id TEXT NOT NULL REFERENCES out_of_date(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_out_of_date_items_out_of_date_id ON out_of_date_items(out_of_date_id);
CREATE INDEX IF NOT EXISTS idx_out_of_date_items_product_id ON out_of_date_items(product_id);
