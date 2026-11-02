-- V13__triage_files_compliance_and_reviews.sql
-- 1. Triage & Appointment file attachments (symptom images, prior prescriptions)
-- 2. Doctor post-appointment reviews and ratings
-- 3. Doctor review count column
-- 4. User account deletion compliance columns (preserves hospital clinical records)

-- 1. Attachment records linked to triage intake and appointments
CREATE TABLE triage_attachments (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_id     UUID         REFERENCES triage_assessments(id) ON DELETE SET NULL,
    appointment_id    UUID         REFERENCES appointments(id) ON DELETE SET NULL,
    file_name         VARCHAR(255) NOT NULL,
    stored_file_name  VARCHAR(255) NOT NULL,
    file_url          VARCHAR(512) NOT NULL,
    file_category     VARCHAR(64)  NOT NULL DEFAULT 'SYMPTOM_IMAGE',
    mime_type         VARCHAR(128) NOT NULL,
    file_size_bytes   BIGINT       NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_file_category CHECK (file_category IN ('SYMPTOM_IMAGE', 'PRIOR_PRESCRIPTION', 'LAB_REPORT', 'OTHER'))
);

CREATE INDEX idx_triage_attachments_patient ON triage_attachments(patient_id);
CREATE INDEX idx_triage_attachments_appt ON triage_attachments(appointment_id);
CREATE INDEX idx_triage_attachments_assessment ON triage_attachments(assessment_id);

-- 2. Doctor review and feedback table
CREATE TABLE doctor_reviews (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id    UUID         NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id         UUID         NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_name      VARCHAR(128) NOT NULL,
    rating            INTEGER      NOT NULL,
    comment           TEXT,
    tags              VARCHAR(256),
    is_anonymous      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_review_rating CHECK (rating >= 1 AND rating <= 5)
);

CREATE INDEX idx_doctor_reviews_doctor ON doctor_reviews(doctor_id, created_at DESC);
CREATE INDEX idx_doctor_reviews_patient ON doctor_reviews(patient_id);

-- 3. Add review_count to doctors table (rating already exists from V3)
ALTER TABLE doctors ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;

-- 4. Compliance: User account deletion tracking while preserving hospital clinical records
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_users_is_deleted ON users(is_deleted);
