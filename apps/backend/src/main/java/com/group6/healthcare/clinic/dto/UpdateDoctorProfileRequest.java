package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record UpdateDoctorProfileRequest(
        @Size(max = 255) String fullName,
        @Size(max = 128) String specialty,
        @Size(max = 256) String hospitalName,
        UUID hospitalId,
        @Size(max = 64) String registrationNumber,
        Integer yearsExperience,
        BigDecimal consultationFee,
        @Size(max = 256) String languages,
        @Size(max = 2000) String bio,
        @Size(max = 512) String avatarUrl
) {}
