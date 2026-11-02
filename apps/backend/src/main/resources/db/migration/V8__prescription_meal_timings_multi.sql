-- V8__prescription_meal_timings_multi.sql
-- A medication can now have multiple meal-timings (e.g. "after breakfast AND after dinner").
-- We keep the same column name but switch its contents from one enum value to a
-- comma-separated list of enum values. Validation moves to the service layer.
--
-- Existing single-value rows remain valid CSVs of length 1, so no data backfill needed.

ALTER TABLE prescription_items
    DROP CONSTRAINT chk_prescription_items_meal_timing;

-- Widen the column so CSV fits comfortably (max 10 timings * 20 chars ≈ 220 chars).
ALTER TABLE prescription_items
    ALTER COLUMN meal_timing TYPE VARCHAR(256);
