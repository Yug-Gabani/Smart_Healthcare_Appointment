package com.group6.healthcare.payment.dto;

public record CancelAndRefundRequest(
        String reason,
        Double simulatedHoursRemaining // Optional test simulation parameter to easily test all 4 tiers
) {}

