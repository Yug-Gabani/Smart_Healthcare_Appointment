-- V15__video_consultations_and_summaries.sql
-- Table to manage live video consultation sessions, WebRTC metadata, and post-visit clinical summaries.
-- Linked 1-to-1 with an appointment of consultation_type = 'VIDEO'.

CREATE TABLE consultation_sessions (
    id                      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id          UUID         NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    room_id                 VARCHAR(64)  NOT NULL UNIQUE,
    status                  VARCHAR(32)  NOT NULL DEFAULT 'SCHEDULED',
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    transcript              TEXT,
    summary_chief_complaint TEXT,
    summary_observations    TEXT,
    summary_doctor_advice   TEXT,
    summary_prescribed_actions TEXT,
    summary_follow_up       TEXT,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_consultation_status CHECK (status IN ('SCHEDULED', 'WAITING', 'IN_PROGRESS', 'COMPLETED'))
);

CREATE INDEX ix_consultation_sessions_appt ON consultation_sessions (appointment_id);
CREATE INDEX ix_consultation_sessions_room ON consultation_sessions (room_id);
