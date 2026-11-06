package com.group6.healthcare.payment.service;

import com.group6.healthcare.payment.entity.NotificationAuditLog;
import com.group6.healthcare.payment.repository.NotificationAuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class NotificationAuditService {

    private static final Logger log = LoggerFactory.getLogger(NotificationAuditService.class);

    private final NotificationAuditLogRepository auditLogRepository;

    public NotificationAuditService(NotificationAuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Record an audit step in the notification lifecycle.
     * Uses REQUIRES_NEW propagation to ensure audit trail records persist even if an outer transaction fails.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationAuditLog recordLog(
            String orderId,
            UUID appointmentId,
            NotificationAuditLog.Channel channel,
            String recipient,
            NotificationAuditLog.Status status,
            String details) {

        NotificationAuditLog audit = NotificationAuditLog.builder()
                .orderId(orderId)
                .appointmentId(appointmentId)
                .channel(channel)
                .recipient(recipient)
                .status(status)
                .details(details)
                .completedAt(status == NotificationAuditLog.Status.DELIVERED || status == NotificationAuditLog.Status.DISPATCHED ? Instant.now() : null)
                .build();

        NotificationAuditLog saved = auditLogRepository.save(audit);
        log.info("[NOTIFICATION AUDIT] [{}] [{}] Order: {} -> {} ({})",
                channel, status, orderId, recipient, details != null ? details : "OK");
        return saved;
    }

    @Transactional(readOnly = true)
    public List<NotificationAuditLog> getLogsForOrder(String orderId) {
        return auditLogRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
    }

    @Transactional(readOnly = true)
    public List<NotificationAuditLog> getRecentLogs() {
        return auditLogRepository.findTop100ByOrderByCreatedAtDesc();
    }
}

