package com.group6.healthcare.payment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.payment.entity.PaymentOutbox;
import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import com.group6.healthcare.payment.repository.PaymentOutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxEventService {

    private static final Logger log = LoggerFactory.getLogger(OutboxEventService.class);

    private final PaymentOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public OutboxEventService(PaymentOutboxRepository outboxRepository, ObjectMapper objectMapper) {
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Persist an event into the transactional outbox table in the SAME database transaction
     * as the business state change (e.g. PaymentOrder update to PAID).
     * Guarantees 100% database-to-Kafka consistency.
     */
    @Transactional
    public PaymentOutbox recordPaymentSuccessEvent(PaymentSuccessEvent event) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(event);
            PaymentOutbox outbox = PaymentOutbox.builder()
                    .aggregateType("PAYMENT_ORDER")
                    .aggregateId(event.razorpayOrderId())
                    .eventType("PaymentSuccessEvent")
                    .payload(jsonPayload)
                    .status(PaymentOutbox.Status.PENDING)
                    .retryCount(0)
                    .build();

            PaymentOutbox saved = outboxRepository.save(outbox);
            log.info("[TRANSACTIONAL OUTBOX] Recorded outbox event {} for order {} (Status: PENDING)",
                    saved.getId(), event.razorpayOrderId());
            return saved;
        } catch (Exception ex) {
            log.error("[TRANSACTIONAL OUTBOX] Failed to serialize event for order {}: {}",
                    event.razorpayOrderId(), ex.getMessage(), ex);
            throw new RuntimeException("Could not persist event in transactional outbox", ex);
        }
    }
}

