package com.group6.healthcare.payment.dto;

public enum RefundTier {
    FULL_100(100, "100% Full Refund", "Cancelled 24+ hours prior to appointment"),
    PARTIAL_50(50, "50% Partial Refund", "Cancelled 12 to 24 hours prior to appointment"),
    PARTIAL_25(25, "25% Partial Refund", "Cancelled 6 to 12 hours prior to appointment"),
    NO_REFUND_0(0, "No Refund (0%)", "Cancelled less than 6 hours prior to appointment"),
    FREE_CONSULTATION(0, "Complimentary", "100% complimentary booking - no fee charged");

    private final int percentage;
    private final String label;
    private final String description;

    RefundTier(int percentage, String label, String description) {
        this.percentage = percentage;
        this.label = label;
        this.description = description;
    }

    public int getPercentage() {
        return percentage;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }
}

