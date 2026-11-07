package com.group6.healthcare.payment.repository;

import com.group6.healthcare.payment.entity.PaymentRefund;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, UUID> {
    Optional<PaymentRefund> findByAppointmentId(UUID appointmentId);
    Optional<PaymentRefund> findFirstByAppointmentIdOrderByCreatedAtDesc(UUID appointmentId);
    Optional<PaymentRefund> findByRazorpayRefundId(String razorpayRefundId);
    List<PaymentRefund> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}

