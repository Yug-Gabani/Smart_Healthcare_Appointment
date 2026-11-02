-- V10__doctor_hospital_fk.sql
-- Replace the free-text `hospital` string on doctors with a proper FK to hospitals.
-- The ClinicSeedRunner matches each demo doctor to a real hospital row and populates hospital_id;
-- boot fails if any demo doctor cannot be matched (strict mode, per team decision).

ALTER TABLE doctors
    ADD COLUMN hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL;

CREATE INDEX ix_doctors_hospital ON doctors (hospital_id);
