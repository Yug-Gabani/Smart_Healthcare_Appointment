-- V4__triage_assessments.sql
-- AI-advisory triage records. Covers FR-05, FR-07.

CREATE TABLE triage_assessments (
    id                      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chief_complaint         TEXT         NOT NULL,
    symptoms_json           TEXT         NOT NULL DEFAULT '[]',
    duration_days           INTEGER      NOT NULL DEFAULT 0,
    pain_level              INTEGER      NOT NULL DEFAULT 0,
    has_fever               BOOLEAN      NOT NULL DEFAULT FALSE,
    has_chest_pain          BOOLEAN      NOT NULL DEFAULT FALSE,
    has_shortness_of_breath BOOLEAN      NOT NULL DEFAULT FALSE,
    urgency                 VARCHAR(16)  NOT NULL,
    rationale               TEXT         NOT NULL,
    suggested_specialty     VARCHAR(128) NOT NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_triage_urgency CHECK (urgency IN ('EMERGENCY', 'URGENT', 'ROUTINE'))
);

CREATE INDEX ix_triage_patient ON triage_assessments (patient_id, created_at DESC);
