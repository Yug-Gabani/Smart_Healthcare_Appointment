-- V18__cancellation_and_refund_system.sql
-- Implements Tiered Appointment Cancellation and Razorpay Refund System

-- 1. Add refund tracking columns to payment_orders
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS refund_id VARCHAR(64);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS refund_amount_paise BIGINT DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS refund_percentage INT DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

-- 2. Add cancellation tracking columns to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS refund_percentage INT DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS refund_amount_paise BIGINT DEFAULT 0;

-- 3. Dedicated audit table for all refund transactions
CREATE TABLE IF NOT EXISTS payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID REFERENCES payment_orders(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL,
    razorpay_payment_id VARCHAR(64),
    razorpay_refund_id VARCHAR(64) UNIQUE,
    original_amount_paise BIGINT NOT NULL,
    refund_amount_paise BIGINT NOT NULL,
    retention_amount_paise BIGINT NOT NULL,
    refund_percentage INT NOT NULL,
    tier VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
    hours_before_slot NUMERIC(6, 2),
    policy_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_appointment ON payment_refunds(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_patient ON payment_refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_order ON payment_refunds(payment_order_id);

