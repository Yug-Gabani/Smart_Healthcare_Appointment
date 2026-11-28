package com.group6.healthcare.payment.repository;

import com.group6.healthcare.payment.entity.PaymentOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentOrderRepository extends JpaRepository<PaymentOrder, UUID> {
    Optional<PaymentOrder> findByRazorpayOrderId(String razorpayOrderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PaymentOrder p WHERE p.razorpayOrderId = :razorpayOrderId")
    Optional<PaymentOrder> findByRazorpayOrderIdForUpdate(@Param("razorpayOrderId") String razorpayOrderId);

    Optional<PaymentOrder> findByRazorpayPaymentId(String razorpayPaymentId);

    Optional<PaymentOrder> findByAppointmentId(UUID appointmentId);

    Optional<PaymentOrder> findFirstByAppointmentIdOrderByCreatedAtDesc(UUID appointmentId);

    List<PaymentOrder> findAllByOrderByCreatedAtDesc();

    Page<PaymentOrder> findByCreatedAtBetween(Instant from, Instant to, Pageable pageable);

    Page<PaymentOrder> findByCreatedAtBetweenAndStatus(Instant from, Instant to,
                                                       PaymentOrder.Status status, Pageable pageable);
}

