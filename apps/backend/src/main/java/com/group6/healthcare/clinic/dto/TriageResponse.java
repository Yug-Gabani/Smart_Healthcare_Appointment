package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.Urgency;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TriageResponse(
        UUID id,
        UUID patientId,
        String chiefComplaint,
        List<String> symptoms,
        int durationDays,
        int painLevel,
        boolean fever,
        boolean chestPain,
        boolean shortnessOfBreath,
        Urgency urgency,
        String rationale,
        String suggestedSpecialty,
        boolean aiPowered,
        BigDecimal confidence,
        List<String> redFlags,
        List<String> recommendedActions,
        OffsetDateTime createdAt
) {
    /** Backward-compatible overload for callers that don't yet set the AI fields. */
    public TriageResponse(
            UUID id,
            UUID patientId,
            String chiefComplaint,
            List<String> symptoms,
            int durationDays,
            int painLevel,
            boolean fever,
            boolean chestPain,
            boolean shortnessOfBreath,
            Urgency urgency,
            String rationale,
            String suggestedSpecialty,
            OffsetDateTime createdAt
    ) {
        this(id, patientId, chiefComplaint, symptoms, durationDays, painLevel,
                fever, chestPain, shortnessOfBreath, urgency, rationale,
                suggestedSpecialty, false, null, List.of(), List.of(), createdAt);
    }
}
