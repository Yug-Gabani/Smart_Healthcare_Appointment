package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.DoctorStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record DoctorMeResponse(
        UUID id,
        UUID userId,
        String fullName,
        String specialty,
        String hospital,
        UUID hospitalId,
        String avatarUrl,
        BigDecimal rating,
        Integer reviewCount,
        String bio,
        DoctorStatus status,
        String registrationNumber,
        Integer yearsExperience,
        BigDecimal consultationFee,
        String languages,
        String rejectionReason,
        OffsetDateTime submittedAt,
        OffsetDateTime reviewedAt,
        List<ScheduleTemplateDto> scheduleTemplate,
        String email,
        String phone,
        Long totalAppointments,
        Long completedConsultations
) {
    public DoctorMeResponse(
            UUID id,
            UUID userId,
            String fullName,
            String specialty,
            String hospital,
            UUID hospitalId,
            String avatarUrl,
            BigDecimal rating,
            Integer reviewCount,
            String bio,
            DoctorStatus status,
            String registrationNumber,
            Integer yearsExperience,
            BigDecimal consultationFee,
            String languages,
            String rejectionReason,
            OffsetDateTime submittedAt,
            OffsetDateTime reviewedAt,
            List<ScheduleTemplateDto> scheduleTemplate) {
        this(id, userId, fullName, specialty, hospital, hospitalId, avatarUrl, rating, reviewCount,
             bio, status, registrationNumber, yearsExperience, consultationFee, languages,
             rejectionReason, submittedAt, reviewedAt, scheduleTemplate, null, null, null, null);
    }
}
