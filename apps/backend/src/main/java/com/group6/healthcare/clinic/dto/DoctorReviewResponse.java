package com.group6.healthcare.clinic.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DoctorReviewResponse(
        UUID id,
        UUID appointmentId,
        UUID doctorId,
        String doctorName,
        String doctorSpecialty,
        String patientName,
        int rating,
        String comment,
        String tags,
        boolean isAnonymous,
        OffsetDateTime createdAt
) {}
