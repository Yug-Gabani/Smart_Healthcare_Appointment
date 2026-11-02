package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.PrescriptionStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PrescriptionResponse(
        UUID id,
        UUID appointmentId,
        UUID patientId,
        String patientName,
        UUID doctorId,
        String doctorName,
        String doctorSpecialty,
        String doctorHospital,
        PrescriptionStatus status,
        OffsetDateTime signedAt,
        UUID voidOf,
        String voidReason,
        String notes,
        List<PrescriptionItemDto> items,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
