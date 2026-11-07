package com.group6.healthcare.payment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.payment.config.KafkaPaymentConfig;
import com.group6.healthcare.payment.entity.NotificationAuditLog;
import com.group6.healthcare.payment.entity.PaymentOutbox;
import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import com.group6.healthcare.payment.repository.PaymentOutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class OutboxPublisherService {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherService.class);

    private final PaymentOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final NotificationAuditService auditService;

    @Autowired(required = false)
    private KafkaTemplate<String, PaymentSuccessEvent> kafkaTemplate;

    @Autowired(required = false)
    private PaymentReceiptEmailService emailService;

    public OutboxPublisherService(
            PaymentOutboxRepository outboxRepository,
            ObjectMapper objectMapper,
            NotificationAuditService auditService) {
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
        this.auditService = auditService;
    }

    /**
     * Poller to relay pending outbox events to Kafka.
     * Runs every 2 seconds to guarantee At-Least-Once delivery and crash-recovery.
     */
    @Scheduled(fixedDelayString = "${app.outbox.poll-interval-ms:2000}", initialDelay = 4000)
    public void pollAndPublish() {
        publishPending();
    }

    @Transactional
    public void publishPending() {
        List<PaymentOutbox> pendingList = outboxRepository.findTop50ByStatusInOrderByCreatedAtAsc(
                List.of(PaymentOutbox.Status.PENDING, PaymentOutbox.Status.FAILED)
        );

        if (pendingList.isEmpty()) {
            return;
        }

        for (PaymentOutbox record : pendingList) {
            if (record.getRetryCount() >= 5) {
                continue; // Exhausted retries for this batch
            }
            processOutboxRecord(record);
        }
    }

    private void processOutboxRecord(PaymentOutbox record) {
        try {
            PaymentSuccessEvent event = objectMapper.readValue(record.getPayload(), PaymentSuccessEvent.class);

            if (kafkaTemplate != null) {
                CompletableFuture<SendResult<String, PaymentSuccessEvent>> future = kafkaTemplate.send(
                        KafkaPaymentConfig.PAYMENT_RECEIPT_TOPIC,
                        record.getAggregateId(),
                        event
                );

                if (future != null) {
                    future.whenComplete((result, ex) -> {
                        if (ex == null && result != null) {
                            record.setStatus(PaymentOutbox.Status.SENT);
                            record.setSentAt(Instant.now());
                            record.setErrorMessage(null);
                            outboxRepository.save(record);

                            String details = String.format("Topic: %s | Partition: %d | Offset: %d",
                                    KafkaPaymentConfig.PAYMENT_RECEIPT_TOPIC,
                                    result.getRecordMetadata() != null ? result.getRecordMetadata().partition() : 0,
                                    result.getRecordMetadata() != null ? result.getRecordMetadata().offset() : 0);

                            auditService.recordLog(
                                    event.razorpayOrderId(),
                                    event.appointmentId(),
                                    NotificationAuditLog.Channel.KAFKA,
                                    "Topic: " + KafkaPaymentConfig.PAYMENT_RECEIPT_TOPIC,
                                    NotificationAuditLog.Status.QUEUED,
                                    details
                            );

                            log.info("[TRANSACTIONAL OUTBOX] Successfully published order {} to Kafka (Partition: {}, Offset: {})",
                                    record.getAggregateId(),
                                    result.getRecordMetadata() != null ? result.getRecordMetadata().partition() : 0,
                                    result.getRecordMetadata() != null ? result.getRecordMetadata().offset() : 0);
                        } else {
                            handlePublishFailure(record, event, ex);
                        }
                    });
                } else {
                    handlePublishFailure(record, event, new IllegalStateException("KafkaTemplate returned null future"));
                }
            } else {
                // If KafkaTemplate is absent in test environment or broker is disabled, invoke direct fallback
                record.setStatus(PaymentOutbox.Status.SENT);
                record.setSentAt(Instant.now());
                outboxRepository.save(record);

                auditService.recordLog(
                        event.razorpayOrderId(),
                        event.appointmentId(),
                        NotificationAuditLog.Channel.KAFKA,
                        "Direct In-Memory Fallback",
                        NotificationAuditLog.Status.QUEUED,
                        "Kafka broker absent. Routed to direct in-memory listener."
                );

                if (emailService != null) {
                    emailService.onPaymentSuccess(event);
                }
            }
        } catch (Exception ex) {
            log.error("[TRANSACTIONAL OUTBOX] Deserialization error for outbox record {}: {}", record.getId(), ex.getMessage());
            record.setStatus(PaymentOutbox.Status.FAILED);
            record.setErrorMessage("Deserialization failure: " + ex.getMessage());
            record.setRetryCount(record.getRetryCount() + 1);
            outboxRepository.save(record);
        }
    }

    private void handlePublishFailure(PaymentOutbox record, PaymentSuccessEvent event, Throwable ex) {
        log.warn("[TRANSACTIONAL OUTBOX] Failed to send order {} to Kafka (attempt {}): {}",
                record.getAggregateId(), record.getRetryCount() + 1, ex.getMessage());
        record.setStatus(PaymentOutbox.Status.FAILED);
        record.setRetryCount(record.getRetryCount() + 1);
        record.setErrorMessage(ex != null ? ex.getMessage() : "Unknown publish error");
        outboxRepository.save(record);

        auditService.recordLog(
                event.razorpayOrderId(),
                event.appointmentId(),
                NotificationAuditLog.Channel.KAFKA,
                "Topic: " + KafkaPaymentConfig.PAYMENT_RECEIPT_TOPIC,
                NotificationAuditLog.Status.FAILED,
                "Publish error (attempt " + record.getRetryCount() + "): " + (ex != null ? ex.getMessage() : "broker error")
        );

        // Resilient fallback if retries are climbing: direct execution
        if (record.getRetryCount() >= 3 && emailService != null) {
            log.info("[TRANSACTIONAL OUTBOX] Invoking direct notification pipeline fallback for order {}", record.getAggregateId());
            emailService.onPaymentSuccess(event);
        }
    }
}
