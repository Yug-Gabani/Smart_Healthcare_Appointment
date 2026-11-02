package com.group6.healthcare.user.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record DataExportResponse(
        UUID userId,
        String email,
        String fullName,
        String phone,
        String gender,
        String dateOfBirth,
        Map<String, String> address,
        Map<String, String> emergencyContact,
        OffsetDateTime accountCreatedAt,
        OffsetDateTime exportGeneratedAt,
        List<Map<String, Object>> appointments,
        List<Map<String, Object>> prescriptions,
        List<Map<String, Object>> triageAssessments,
        List<Map<String, Object>> medicalAttachments,
        List<Map<String, Object>> reviews
) {}
