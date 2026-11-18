-- ============================================================================
-- V28: Doctor Vacation/Leave Calendar & Slot Availability Management
-- Issue #82: Recurring Availability Schedule & Vacation/Leave Calendar
-- ============================================================================

-- 1. Add slot availability column to doctor_slots
ALTER TABLE doctor_slots ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS ix_doctor_slots_avail ON doctor_slots (doctor_id, is_booked, is_available, slot_at);

-- 2. Create doctor_leaves table
CREATE TABLE IF NOT EXISTS doctor_leaves (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    reason      VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_doctor_leaves_doctor ON doctor_leaves(doctor_id, start_date, end_date);
