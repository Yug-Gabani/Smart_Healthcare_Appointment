package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.ConsultationSessionStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ConsultationSessionResponse(
        UUID id,
        UUID appointmentId,
        String roomId,
        ConsultationSessionStatus status,
        boolean canJoin,
        String joinMessage,
        OffsetDateTime slotAt,
        String doctorName,
        String patientName,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt,
        String transcript,
        String summaryChiefComplaint,
        String summaryObservations,
        String summaryDoctorAdvice,
        String summaryPrescribedActions,
        String summaryFollowUp,
        OffsetDateTime createdAt
) {
}
