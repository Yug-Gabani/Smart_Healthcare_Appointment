-- V24: enrich triage_assessments with AI-powered fields.
--
-- Backward compatible: all new columns are nullable with sensible defaults, so
-- existing rows remain valid and the rule-based fallback path can keep writing
-- them when ai-service is unreachable.
--
-- ai_powered distinguishes assessments that actually came from the LLM from
-- those that came from the deterministic rule engine. Useful for analytics,
-- A/B comparison and audit (DR-15: AI output is advisory, must be identifiable).

ALTER TABLE triage_assessments
    ADD COLUMN IF NOT EXISTS ai_powered           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS confidence           NUMERIC(3, 2),
    ADD COLUMN IF NOT EXISTS red_flags_json       TEXT,
    ADD COLUMN IF NOT EXISTS recommended_actions_json TEXT;

ALTER TABLE triage_assessments
    ADD CONSTRAINT chk_triage_confidence_range CHECK (
        confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)
    );
