package com.group6.healthcare.clinic.dto;

import java.util.List;

/**
 * Aggregated platform analytics for the admin performance & clinical audit dashboard.
 */
public record AdminAnalyticsResponse(
        List<MonthlyRevenuePoint> monthlyRevenue,
        List<SpecialtyMetric> topSpecialties,
        CancellationMetrics cancellationMetrics
) {
    public record MonthlyRevenuePoint(
            String monthKey,
            String label,
            long revenuePaise,
            long refundPaise,
            long netRevenuePaise,
            long transactionCount
    ) {}

    public record SpecialtyMetric(
            String specialty,
            long appointmentCount,
            long completedCount,
            long cancelledCount,
            long noShowCount,
            long revenuePaise
    ) {}

    public record CancellationMetrics(
            long totalAppointments,
            long completedCount,
            long cancelledCount,
            long noShowCount,
            long bookedCount,
            long confirmedCount,
            long expiredCount,
            double completionRatePct,
            double cancellationRatePct,
            double noShowRatePct
    ) {}
}

