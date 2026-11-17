package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.ConsultationSessionStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * DTO returning live session state, WebRTC metadata, transcription consent status,
 * immutable AI advisory summary, and clinician-verified post-visit summary.
 */
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
        OffsetDateTime createdAt,
        // Enhanced structured clinical fields
        String summaryPatientSymptoms,
        String summaryDiscussionPoints,
        String summaryMissingInfo,
        // AI Advisory vs Clinician Verification Audit
        String aiSummaryRaw,
        OffsetDateTime aiGeneratedAt,
        boolean doctorReviewed,
        OffsetDateTime doctorReviewedAt,
        String doctorOverrideNotes,
        // Dual-consent audit tracking
        boolean patientConsentTranscription,
        boolean doctorConsentTranscription,
        OffsetDateTime consentTimestamp
) {
    // Backward-compatible constructor for existing tests or callers
    public ConsultationSessionResponse(
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
        this(
                id, appointmentId, roomId, status, canJoin, joinMessage, slotAt, doctorName, patientName,
                startedAt, endedAt, transcript, summaryChiefComplaint, summaryObservations,
                summaryDoctorAdvice, summaryPrescribedActions, summaryFollowUp, createdAt,
                null, null, null, null, null, false, null, null, false, false, null
        );
    }
}
