package com.group6.healthcare.payment.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CancelAndRefundResponse(
        UUID appointmentId,
        String appointmentStatus,
        String refundId,
        String razorpayPaymentId,
        long originalAmountPaise,
        long refundAmountPaise,
        long retentionAmountPaise,
        int refundPercentage,
        RefundTier tier,
        String refundStatus,
        String policyMessage,
        OffsetDateTime slotAt,
        OffsetDateTime cancelledAt,
        double hoursRemaining
) {}

