package com.group6.healthcare.payment.repository;

import com.group6.healthcare.payment.entity.NotificationAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationAuditLogRepository extends JpaRepository<NotificationAuditLog, UUID> {
    List<NotificationAuditLog> findByOrderIdOrderByCreatedAtAsc(String orderId);
    List<NotificationAuditLog> findTop100ByOrderByCreatedAtDesc();
}

