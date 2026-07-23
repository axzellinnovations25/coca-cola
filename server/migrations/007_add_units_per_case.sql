-- Units per case vary by pack size. Default 12; backfill known sizes from product names.
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_case INTEGER NOT NULL DEFAULT 12;

UPDATE products SET units_per_case = CASE
  WHEN name ILIKE '%monster%' THEN 24
  WHEN name ILIKE '%water%' AND replace(lower(name), ' ', '') LIKE '%1500ml%' THEN 12
  WHEN name ILIKE '%water%' AND replace(lower(name), ' ', '') LIKE '%1.5l%' THEN 12
  WHEN name ILIKE '%water%' AND replace(lower(name), ' ', '') LIKE '%1000ml%' THEN 15
  WHEN name ILIKE '%water%' AND replace(lower(name), ' ', '') LIKE '%1l%' THEN 15
  WHEN name ILIKE '%water%' AND replace(lower(name), ' ', '') LIKE '%500ml%' THEN 24
  WHEN name ILIKE '%water%' THEN 24
  WHEN replace(lower(name), ' ', '') LIKE '%250ml%' AND name ILIKE '%tin%' THEN 24
  WHEN replace(lower(name), ' ', '') LIKE '%250ml%' THEN 16
  WHEN replace(lower(name), ' ', '') LIKE '%175ml%' THEN 24
  WHEN replace(lower(name), ' ', '') LIKE '%300ml%' THEN 24
  WHEN replace(lower(name), ' ', '') LIKE '%1050ml%' THEN 12
  WHEN replace(lower(name), ' ', '') LIKE '%1.30l%' THEN 12
  WHEN replace(lower(name), ' ', '') LIKE '%1.3l%' THEN 12
  WHEN replace(lower(name), ' ', '') LIKE '%750ml%' THEN 9
  WHEN replace(lower(name), ' ', '') LIKE '%1.25l%' THEN 12
  WHEN replace(lower(name), ' ', '') LIKE '%1250ml%' THEN 12
  WHEN replace(lower(name), ' ', '') LIKE '%2.25l%' THEN 9
  WHEN replace(lower(name), ' ', '') LIKE '%2250ml%' THEN 9
  WHEN replace(lower(name), ' ', '') LIKE '%2l%' THEN 9
  WHEN replace(lower(name), ' ', '') LIKE '%2000ml%' THEN 9
  ELSE 12
END;
