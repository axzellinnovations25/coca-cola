-- admin_id was defined NOT NULL but uses ON DELETE SET NULL.
-- Make it nullable to allow user deletion without breaking referential integrity.
ALTER TABLE out_of_date
  ALTER COLUMN admin_id DROP NOT NULL;













