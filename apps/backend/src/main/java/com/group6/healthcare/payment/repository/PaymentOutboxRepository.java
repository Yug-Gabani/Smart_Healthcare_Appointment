package com.group6.healthcare.payment.repository;

import com.group6.healthcare.payment.entity.PaymentOutbox;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentOutboxRepository extends JpaRepository<PaymentOutbox, UUID> {
    List<PaymentOutbox> findTop50ByStatusInOrderByCreatedAtAsc(List<PaymentOutbox.Status> statuses);
    Optional<PaymentOutbox> findByAggregateId(String aggregateId);
}

