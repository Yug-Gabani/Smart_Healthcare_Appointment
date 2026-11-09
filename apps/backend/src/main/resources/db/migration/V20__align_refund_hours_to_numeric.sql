-- Align hours_before_slot to NUMERIC(6, 2) to match BigDecimal mapping in PaymentRefund entity
ALTER TABLE payment_refunds
    ALTER COLUMN hours_before_slot TYPE NUMERIC(6, 2) USING hours_before_slot::numeric(6, 2);

