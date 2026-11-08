-- V19: Patient health information on the users table.
--
-- Three self-reported health fields shown on the patient dashboard's right rail
-- and editable from /profile. Kept on `users` (rather than a new patient_profiles
-- table) because that is where the rest of patient profile data already lives
-- (date_of_birth, address_*, emergency_contact_*).
--
-- All nullable: a patient can sign up and use the app without filling these in;
-- the dashboard shows an em-dash until a value is saved.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS blood_group VARCHAR(8),
    ADD COLUMN IF NOT EXISTS allergies   TEXT,
    ADD COLUMN IF NOT EXISTS conditions  TEXT;

-- Loose check — the frontend dropdown offers the eight standard groups + UNKNOWN,
-- but we allow NULL for "not entered yet" and keep the list extensible.
ALTER TABLE users
    ADD CONSTRAINT chk_users_blood_group CHECK (
        blood_group IS NULL
        OR blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','UNKNOWN')
    );
