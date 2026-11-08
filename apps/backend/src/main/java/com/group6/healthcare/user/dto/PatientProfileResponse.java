package com.group6.healthcare.user.dto;

import java.time.LocalDate;
import java.util.UUID;

public record PatientProfileResponse(
        UUID id,
        String email,
        String fullName,
        String phone,
        LocalDate dateOfBirth,
        String gender,
        String addressStreet,
        String addressCity,
        String addressState,
        String addressPincode,
        String emergencyContactName,
        String emergencyContactPhone,
        /* Self-reported health fields (V19). Surfaced on the dashboard's right rail. */
        String bloodGroup,
        String allergies,
        String conditions
) {}
