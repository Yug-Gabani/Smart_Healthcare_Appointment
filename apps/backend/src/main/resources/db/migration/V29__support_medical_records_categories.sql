-- V29__support_medical_records_categories.sql
-- Expand triage_attachments file_category check constraint to support dedicated medical vault categories

ALTER TABLE triage_attachments DROP CONSTRAINT IF EXISTS chk_file_category;

ALTER TABLE triage_attachments ADD CONSTRAINT chk_file_category
    CHECK (file_category IN (
        'SYMPTOM_IMAGE',
        'PRIOR_PRESCRIPTION',
        'LAB_REPORT',
        'BLOOD_REPORT',
        'MRI',
        'XRAY',
        'PRESCRIPTION',
        'OTHER'
    ));

