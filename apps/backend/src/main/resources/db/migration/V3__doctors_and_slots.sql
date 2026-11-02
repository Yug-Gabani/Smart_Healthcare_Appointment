-- V3__doctors_and_slots.sql
-- Clinical directory and bookable slot inventory.
-- Covers FR-03 (browse doctors), FR-04 (slot locking).

CREATE TABLE doctors (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         REFERENCES users(id) ON DELETE SET NULL,
    full_name       VARCHAR(255) NOT NULL,
    specialty       VARCHAR(128) NOT NULL,
    hospital        VARCHAR(255) NOT NULL,
    avatar_url      VARCHAR(512),
    rating          NUMERIC(3,2) NOT NULL DEFAULT 4.80,
    bio             TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_doctors_specialty ON doctors (specialty);

CREATE TABLE doctor_slots (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id       UUID         NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    slot_at         TIMESTAMPTZ  NOT NULL,
    is_booked       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_doctor_slot_time   ON doctor_slots (doctor_id, slot_at);
CREATE        INDEX ix_doctor_slots_open  ON doctor_slots (doctor_id, is_booked, slot_at);
