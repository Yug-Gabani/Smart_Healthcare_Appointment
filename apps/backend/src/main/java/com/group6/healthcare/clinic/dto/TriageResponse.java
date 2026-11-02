package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.Urgency;

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
        OffsetDateTime createdAt
) {}
