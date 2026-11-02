-- Doctor verification lifecycle + extended profile fields + weekly schedule template.
--
-- Existing seeded doctors must stay visible, so the status column defaults to APPROVED.
-- New doctors who self-register start as PENDING and must be approved by an admin before
-- they appear in any patient-facing search.

ALTER TABLE doctors ADD COLUMN status              VARCHAR(16)   NOT NULL DEFAULT 'APPROVED';
ALTER TABLE doctors ADD COLUMN registration_number VARCHAR(64);
ALTER TABLE doctors ADD COLUMN years_experience    INTEGER;
ALTER TABLE doctors ADD COLUMN consultation_fee    NUMERIC(10,2);
ALTER TABLE doctors ADD COLUMN languages           VARCHAR(256);
ALTER TABLE doctors ADD COLUMN rejection_reason    TEXT;
ALTER TABLE doctors ADD COLUMN submitted_at        TIMESTAMPTZ;
ALTER TABLE doctors ADD COLUMN reviewed_at         TIMESTAMPTZ;
ALTER TABLE doctors ADD COLUMN reviewed_by         UUID REFERENCES users(id);

CREATE INDEX idx_doctors_status ON doctors(status);

-- Weekly recurring availability template. The slot generator reads these rows and
-- materializes concrete DoctorSlot rows for the next N days.
CREATE TABLE doctor_schedule_templates (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id              UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week            INTEGER NOT NULL,
    start_time             TIME NOT NULL,
    end_time               TIME NOT NULL,
    slot_duration_minutes  INTEGER NOT NULL DEFAULT 30,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dow      CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_duration CHECK (slot_duration_minutes IN (15, 20, 30, 45, 60)),
    CONSTRAINT chk_time     CHECK (start_time < end_time)
);
CREATE INDEX idx_schedule_templates_doctor ON doctor_schedule_templates(doctor_id);
