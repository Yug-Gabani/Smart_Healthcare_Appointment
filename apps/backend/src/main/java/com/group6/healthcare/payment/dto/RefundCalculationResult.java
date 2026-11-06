package com.group6.healthcare.payment.dto;

public record RefundCalculationResult(
        double hoursRemaining,
        RefundTier tier,
        int refundPercentage,
        long originalAmountPaise,
        long refundAmountPaise,
        long retentionAmountPaise,
        String policyMessage,
        boolean eligibleForRefund
) {}

