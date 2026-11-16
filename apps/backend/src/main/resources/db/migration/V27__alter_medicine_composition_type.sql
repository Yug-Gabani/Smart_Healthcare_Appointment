-- Migration V27: Alter composition column type in medicines table
-- Fixes lower(bytea) error by converting composition from BYTEA to VARCHAR(500)
-- This migration is safe as existing data is textual.
ALTER TABLE medicines
    ALTER COLUMN composition TYPE VARCHAR(500) USING composition::text;

