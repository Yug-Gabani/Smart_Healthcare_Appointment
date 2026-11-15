-- V23: patient-initiated reschedule + doctor-recommended follow-up appointments.
--
-- Reschedule columns live on the existing appointment row (no new table):
-- the point of reschedule is that it stays the SAME appointment, with a new slot.
-- A lightweight counter and timestamp give the clinician enough history to spot
-- a patient who has moved the same consult five times.
--
-- Follow-up columns capture (a) the doctor's suggestion on the prescription and
-- (b) the parent link on the new appointment that the patient books from it,
-- so the clinical thread is navigable both directions.

-- --------------------------------------------------------------------------
-- Reschedule — on appointments
-- --------------------------------------------------------------------------
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS reschedule_count     INT         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_rescheduled_at  TIMESTAMPTZ;

-- --------------------------------------------------------------------------
-- Follow-up — on prescriptions (doctor's recommendation) and on appointments
-- (the new row created from that recommendation).
-- --------------------------------------------------------------------------
ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS follow_up_after_days INT,
    ADD COLUMN IF NOT EXISTS follow_up_notes      TEXT;

ALTER TABLE prescriptions
    ADD CONSTRAINT chk_prescriptions_follow_up_days_range CHECK (
        follow_up_after_days IS NULL OR (follow_up_after_days BETWEEN 1 AND 365)
    );

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS parent_appointment_id UUID
        REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_parent_id
    ON appointments(parent_appointment_id);
