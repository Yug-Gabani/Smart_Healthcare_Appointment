package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.PharmacyOrderStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PharmacyOrderResponse(
        UUID id,
        UUID prescriptionId,
        UUID patientId,
        String patientName,
        UUID pharmacistId,
        String pharmacistName,
        PharmacyOrderStatus status,
        String doctorName,
        String doctorSpecialty,
        List<PrescriptionItemDto> items,
        String prescriptionNotes,
        OffsetDateTime dispensedAt,
        OffsetDateTime pickedUpAt,
        OffsetDateTime cancelledAt,
        String cancelledReason,
        String notes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
