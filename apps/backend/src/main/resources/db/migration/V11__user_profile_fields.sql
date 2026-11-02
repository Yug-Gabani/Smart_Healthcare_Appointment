-- V11__user_profile_fields.sql
-- Patient profile fields. All nullable — patient can save partial profiles.
-- Covers FR-02 (profile edit), DR-16 (emergency contact for escalation).

ALTER TABLE users
    ADD COLUMN date_of_birth              DATE,
    ADD COLUMN gender                     VARCHAR(16),
    ADD COLUMN address_street             TEXT,
    ADD COLUMN address_city               VARCHAR(128),
    ADD COLUMN address_state              VARCHAR(128),
    ADD COLUMN address_pincode            VARCHAR(16),
    ADD COLUMN emergency_contact_name     VARCHAR(255),
    ADD COLUMN emergency_contact_phone    VARCHAR(50);

ALTER TABLE users
    ADD CONSTRAINT chk_users_gender CHECK (gender IS NULL OR gender IN
        ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'));
