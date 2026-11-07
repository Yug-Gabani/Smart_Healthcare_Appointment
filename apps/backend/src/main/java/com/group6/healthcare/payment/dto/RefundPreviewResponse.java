package com.group6.healthcare.payment.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RefundPreviewResponse(
        UUID appointmentId,
        String doctorName,
        OffsetDateTime slotAt,
        double hoursRemaining,
        RefundTier tier,
        int refundPercentage,
        long originalAmountPaise,
        long refundAmountPaise,
        long retentionAmountPaise,
        String policyMessage,
        boolean eligibleForRefund,
        boolean canCancel,
        String currentAppointmentStatus,
        String paymentStatus,
        String razorpayPaymentId,
        String simulatedNotice
) {}

