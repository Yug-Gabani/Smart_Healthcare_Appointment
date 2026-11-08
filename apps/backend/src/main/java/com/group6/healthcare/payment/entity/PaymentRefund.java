package com.group6.healthcare.payment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payment_refunds")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentRefund {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "payment_order_id")
    private UUID paymentOrderId;

    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "razorpay_payment_id", length = 64)
    private String razorpayPaymentId;

    @Column(name = "razorpay_refund_id", length = 64, unique = true)
    private String razorpayRefundId;

    @Column(name = "original_amount_paise", nullable = false)
    private Long originalAmountPaise;

    @Column(name = "refund_amount_paise", nullable = false)
    private Long refundAmountPaise;

    @Column(name = "retention_amount_paise", nullable = false)
    private Long retentionAmountPaise;

    @Column(name = "refund_percentage", nullable = false)
    private Integer refundPercentage;

    @Column(name = "tier", nullable = false, length = 32)
    private String tier;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    /* NUMERIC(6,2) in the DB (V18 migration) — mapped as BigDecimal so Hibernate's
     * schema validation matches and so tier-boundary comparisons (e.g. 23.99 vs 24.0)
     * are exact rather than subject to float imprecision. */
    @Column(name = "hours_before_slot", precision = 6, scale = 2)
    private BigDecimal hoursBeforeSlot;

    @Column(name = "policy_message", columnDefinition = "TEXT")
    private String policyMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

