package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.NotNull;

/**
 * DTO for attending doctor to review, edit, and confirm post-consultation clinical summary.
 * Fulfills DR-15 and DR-16 by capturing clinician overrides while keeping raw AI advisory output intact.
 */
public record DoctorReviewSummaryRequest(
        String chiefComplaint,
        String patientSymptoms,
        String discussionPoints,
        String observations,
        String doctorAdvice,
        String prescribedActions,
        String followUp,
        String missingInfo,
        String overrideNotes,
        @NotNull Boolean confirmVerification
) {
}
