package com.group6.healthcare.clinic.dto;

import java.util.List;

public record AdminAnalyticsResponse(
        List<MonthlyRevenueDto> monthlyRevenue,
        List<SpecialtyBreakdownDto> topSpecialties,
        CancellationMetricsDto cancellationMetrics
) {

    public record MonthlyRevenueDto(
            String month,       // e.g. "2024-11"
            String label,       // e.g. "Nov 2024"
            long revenuePaise,
            long refundPaise,
            long netPaise,
            long appointmentCount
    ) {}

    public record SpecialtyBreakdownDto(
            String specialty,
            long appointmentCount,
            long revenuePaise
    ) {}

    public record CancellationMetricsDto(
            long totalAppointments,
            long cancelledCount,
            long noShowCount,
            double cancellationRate,  // percentage
            double noShowRate         // percentage
    ) {}
}
