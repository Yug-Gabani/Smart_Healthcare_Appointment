package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Urgency;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AppointmentResponse(
        UUID id,
        UUID patientId,
        String patientName,
        UUID doctorId,
        String doctorName,
        String doctorSpecialty,
        String doctorHospital,
        String doctorAvatarUrl,
        UUID slotId,
        OffsetDateTime slotAt,
        UUID assessmentId,
        ConsultationType consultationType,
        Urgency urgency,
        AppointmentStatus status,
        String chiefComplaint,
        String notes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<AttachmentResponse> attachments
) {
    public AppointmentResponse(
            UUID id,
            UUID patientId,
            String patientName,
            UUID doctorId,
            String doctorName,
            String doctorSpecialty,
            String doctorHospital,
            String doctorAvatarUrl,
            UUID slotId,
            OffsetDateTime slotAt,
            UUID assessmentId,
            ConsultationType consultationType,
            Urgency urgency,
            AppointmentStatus status,
            String chiefComplaint,
            String notes,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
        this(
                id, patientId, patientName, doctorId, doctorName, doctorSpecialty,
                doctorHospital, doctorAvatarUrl, slotId, slotAt, assessmentId,
                consultationType, urgency, status, chiefComplaint, notes,
                createdAt, updatedAt, List.of()
        );
    }
}
