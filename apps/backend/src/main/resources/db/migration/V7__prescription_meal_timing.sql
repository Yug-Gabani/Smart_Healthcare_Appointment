-- V7__prescription_meal_timing.sql
-- Structured meal-timing field so patients see clear "after breakfast" / "before dinner" etc.
-- instead of free-text buried in instructions.

ALTER TABLE prescription_items
    ADD COLUMN meal_timing VARCHAR(32) NOT NULL DEFAULT 'UNSPECIFIED';

ALTER TABLE prescription_items
    ADD CONSTRAINT chk_prescription_items_meal_timing CHECK (meal_timing IN (
        'UNSPECIFIED',
        'BEFORE_BREAKFAST',
        'AFTER_BREAKFAST',
        'BEFORE_LUNCH',
        'AFTER_LUNCH',
        'BEFORE_DINNER',
        'AFTER_DINNER',
        'WITH_MEAL',
        'EMPTY_STOMACH',
        'AT_BEDTIME',
        'AS_NEEDED'
    ));
