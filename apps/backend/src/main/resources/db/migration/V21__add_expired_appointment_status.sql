-- V20: Add EXPIRED status to appointments
-- Allows appointments whose scheduled consultation window has passed without completion
-- or cancellation to transition to EXPIRED.

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointments_status;

ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status CHECK (status IN
    ('BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED'));

