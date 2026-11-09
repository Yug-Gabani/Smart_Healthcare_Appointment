package com.group6.healthcare.payment.service;

import com.group6.healthcare.payment.entity.NotificationAuditLog;

import java.util.List;
import java.util.UUID;

/**
 * Interface for NotificationAuditService.
 * Using an interface allows Mockito to create JDK dynamic proxies (instead of byte-buddy
 * concrete-class instrumentation) which works reliably on Java 21+.
 */
public interface NotificationAuditServiceI {

    NotificationAuditLog recordLog(
            String orderId,
            UUID appointmentId,
            NotificationAuditLog.Channel channel,
            String recipient,
            NotificationAuditLog.Status status,
            String details
    );

    List<NotificationAuditLog> getLogsForOrder(String orderId);

    List<NotificationAuditLog> getRecentLogs();
}

