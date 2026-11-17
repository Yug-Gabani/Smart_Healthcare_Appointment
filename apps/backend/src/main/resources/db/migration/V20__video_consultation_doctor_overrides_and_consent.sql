-- V20__video_consultation_doctor_overrides_and_consent.sql
-- Adds clinical safety audit columns for:
-- 1. Immutable original AI advisory summary storage (DR-15, DR-16).
-- 2. Clinician review, timestamp, reviewer UUID, and doctor override notes.
-- 3. Explicit dual-consent audit tracking for audio/video transcription (DR-11).
-- 4. Structured clinical fields matching the 6-dimension summary standard.

ALTER TABLE consultation_sessions
    ADD COLUMN IF NOT EXISTS ai_summary_raw TEXT,
    ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS doctor_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS doctor_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS doctor_reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS doctor_override_notes TEXT,
    ADD COLUMN IF NOT EXISTS patient_consent_transcription BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS doctor_consent_transcription BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS summary_patient_symptoms TEXT,
    ADD COLUMN IF NOT EXISTS summary_discussion_points TEXT,
    ADD COLUMN IF NOT EXISTS summary_missing_info TEXT;

CREATE INDEX IF NOT EXISTS ix_consultation_sessions_reviewed ON consultation_sessions(doctor_reviewed);
