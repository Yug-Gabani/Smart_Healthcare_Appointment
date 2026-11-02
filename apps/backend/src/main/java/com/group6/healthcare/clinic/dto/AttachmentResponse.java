package com.group6.healthcare.clinic.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AttachmentResponse(
        UUID id,
        UUID patientId,
        UUID assessmentId,
        UUID appointmentId,
        String fileName,
        String fileUrl,
        String fileCategory,
        String mimeType,
        long fileSizeBytes,
        OffsetDateTime createdAt
) {}
