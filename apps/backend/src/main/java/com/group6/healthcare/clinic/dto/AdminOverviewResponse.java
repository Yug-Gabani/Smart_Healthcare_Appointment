package com.group6.healthcare.clinic.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminOverviewResponse(
        AdminStats stats,
        List<RecentConsultationDto> recentConsultations,
        List<PendingDoctorDto> pendingDoctors,
        SystemHealthDto systemHealth
) {
    public record AdminStats(
            long totalDoctors,
            long approvedDoctors,
            long pendingDoctors,
            long rejectedDoctors,
            long suspendedDoctors,
            long totalPatients,
            long totalAppointments,
            long bookedAppointments,
            long completedAppointments,
            long cancelledAppointments,
            long totalRevenuePaise,
            long totalRefundPaise,
            long totalHospitals
    ) {
        public AdminStats(
                long totalDoctors, long approvedDoctors, long pendingDoctors, long rejectedDoctors,
                long totalPatients, long totalAppointments, long bookedAppointments,
                long completedAppointments, long cancelledAppointments, long totalRevenuePaise,
                long totalRefundPaise, long totalHospitals) {
            this(totalDoctors, approvedDoctors, pendingDoctors, rejectedDoctors, 0L,
                 totalPatients, totalAppointments, bookedAppointments, completedAppointments,
                 cancelledAppointments, totalRevenuePaise, totalRefundPaise, totalHospitals);
        }
    }

    public record RecentConsultationDto(
            UUID id,
            String patientName,
            String patientEmail,
            String doctorName,
            String doctorSpecialty,
            String consultationType,
            String status,
            String urgency,
            OffsetDateTime slotAt,
            Long feeRupees,
            OffsetDateTime createdAt
    ) {}

    public record PendingDoctorDto(
            UUID id,
            String fullName,
            String specialty,
            String hospital,
            String registrationNumber,
            Integer yearsExperience,
            OffsetDateTime submittedAt
    ) {}

    public record SystemHealthDto(
            String databaseStatus,
            long totalHospitalsLoaded,
            long outboxPendingCount,
            String platformStatus
    ) {}
}

