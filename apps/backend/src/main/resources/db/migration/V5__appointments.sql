-- V5__appointments.sql
-- Appointment ledger linking patient, doctor, slot and the triage that produced the booking.
-- Covers FR-04 (booking), FR-09 (listing).

CREATE TABLE appointments (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id       UUID         NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    slot_id         UUID         NOT NULL REFERENCES doctor_slots(id) ON DELETE RESTRICT,
    assessment_id   UUID         REFERENCES triage_assessments(id) ON DELETE SET NULL,
    consultation_type VARCHAR(16) NOT NULL DEFAULT 'VIDEO',
    urgency         VARCHAR(16)  NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'BOOKED',
    chief_complaint TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_appointments_slot    UNIQUE (slot_id),
    CONSTRAINT chk_appointments_status CHECK (status IN
        ('BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    CONSTRAINT chk_appointments_urgency CHECK (urgency IN
        ('EMERGENCY', 'URGENT', 'ROUTINE')),
    CONSTRAINT chk_appointments_consult CHECK (consultation_type IN
        ('VIDEO', 'IN_PERSON'))
);

CREATE INDEX ix_appointments_patient ON appointments (patient_id, created_at DESC);
CREATE INDEX ix_appointments_doctor  ON appointments (doctor_id, status);
