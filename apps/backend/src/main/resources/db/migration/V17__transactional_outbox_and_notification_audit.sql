-- V17__transactional_outbox_and_notification_audit.sql
-- Implements Transactional Outbox Pattern and Notification Audit Log Trail

CREATE TABLE IF NOT EXISTS payment_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL DEFAULT 'PAYMENT_ORDER',
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_outbox_status_created ON payment_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_outbox_aggregate_id ON payment_outbox(aggregate_id);

CREATE TABLE IF NOT EXISTS notification_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(64) NOT NULL,
    appointment_id UUID,
    channel VARCHAR(32) NOT NULL, -- 'KAFKA', 'EMAIL', 'WHATSAPP', 'DLQ'
    recipient VARCHAR(255),
    status VARCHAR(32) NOT NULL,  -- 'QUEUED', 'DISPATCHED', 'DELIVERED', 'FAILED', 'DLQ_ROUTED'
    details TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notification_audit_order ON notification_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_audit_created ON notification_audit_logs(created_at DESC);

