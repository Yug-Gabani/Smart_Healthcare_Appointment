-- V28: Doctor vacation and leave calendar
-- Allows doctors to mark leave/vacation date ranges, which automatically
-- suppresses slot generation and removes unbooked slots during their absence.

CREATE TABLE IF NOT EXISTS doctor_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_doctor_leaves_range CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_doctor_leaves_doctor ON doctor_leaves(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_leaves_dates ON doctor_leaves(doctor_id, start_date, end_date);
