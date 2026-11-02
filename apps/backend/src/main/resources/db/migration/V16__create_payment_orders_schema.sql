-- V16__create_payment_orders_schema.sql
-- Independent payment_orders ledger loosely coupled to user and doctor PKs.

CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    appointment_id UUID,
    razorpay_order_id VARCHAR(64) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(64),
    razorpay_signature VARCHAR(256),
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    receipt VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order ON payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_patient ON payment_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);

