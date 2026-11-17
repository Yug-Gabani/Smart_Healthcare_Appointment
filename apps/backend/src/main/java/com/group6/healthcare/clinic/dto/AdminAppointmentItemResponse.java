package com.group6.healthcare.clinic.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminAppointmentItemResponse(
        UUID id,
        UUID patientId,
        String patientName,
        String patientEmail,
        UUID doctorId,
        String doctorName,
        String doctorSpecialty,
        String hospitalName,
        String consultationType,
        String status,
        String urgency,
        String chiefComplaint,
        OffsetDateTime slotAt,
        Long feeRupees,
        Integer refundPercentage,
        Long refundAmountPaise,
        String cancellationReason,
        OffsetDateTime createdAt
) {}

