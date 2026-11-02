-- Opt-in pharmacy fulfillment. A patient chooses to send a signed prescription to our pharmacy;
-- they are also free to take the PDF to any outside pharmacy. There is no price, delivery, or
-- inventory tracking in this slice — those are deferred.
--
-- Status machine (service-enforced):
--   NEW ──> DISPENSED ──> PICKED_UP     (terminal)
--     └────> CANCELLED                   (patient while NEW, pharmacist any time pre-PICKED_UP)
--
-- `prescription_id` is NOT unique: once an order is CANCELLED the patient may re-order from the
-- same prescription. The service enforces at most one active (non-CANCELLED, non-PICKED_UP) order
-- per prescription.

CREATE TABLE pharmacy_orders (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id   UUID NOT NULL REFERENCES prescriptions(id),
    patient_id        UUID NOT NULL REFERENCES users(id),
    pharmacist_id     UUID REFERENCES users(id),
    status            VARCHAR(16) NOT NULL,
    dispensed_at      TIMESTAMPTZ,
    picked_up_at      TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ,
    cancelled_reason  TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pharmacy_orders_status      ON pharmacy_orders(status);
CREATE INDEX idx_pharmacy_orders_patient     ON pharmacy_orders(patient_id);
CREATE INDEX idx_pharmacy_orders_prescription ON pharmacy_orders(prescription_id);
