-- V6__prescriptions.sql
-- Prescription records with immutable-once-signed protocol (DR-03).
-- Covers FR-16 (prescription issue + patient view).

CREATE TABLE prescriptions (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id  UUID         NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id       UUID         NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    status          VARCHAR(16)  NOT NULL,
    signed_at       TIMESTAMPTZ,
    void_of         UUID         REFERENCES prescriptions(id) ON DELETE SET NULL,
    void_reason     TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_prescriptions_status CHECK (status IN ('DRAFT', 'SIGNED', 'VOIDED')),
    CONSTRAINT chk_prescriptions_signed CHECK (
        (status = 'SIGNED' AND signed_at IS NOT NULL)
        OR (status <> 'SIGNED')
    ),
    CONSTRAINT chk_prescriptions_void_shape CHECK (
        (status = 'VOIDED' AND void_of IS NOT NULL AND void_reason IS NOT NULL)
        OR (status <> 'VOIDED')
    )
);

CREATE INDEX ix_prescriptions_appt    ON prescriptions (appointment_id, status);
CREATE INDEX ix_prescriptions_patient ON prescriptions (patient_id, created_at DESC);
CREATE INDEX ix_prescriptions_doctor  ON prescriptions (doctor_id, created_at DESC);

CREATE TABLE prescription_items (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID         NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    drug_name       VARCHAR(255) NOT NULL,
    dose            VARCHAR(64)  NOT NULL,
    frequency       VARCHAR(64)  NOT NULL,
    duration        VARCHAR(64)  NOT NULL,
    instructions    TEXT,
    position        INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_prescription_items_rx ON prescription_items (prescription_id, position);
