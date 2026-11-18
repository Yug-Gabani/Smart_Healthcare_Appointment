package com.group6.healthcare.clinic.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record DoctorLeaveResponse(
        UUID id,
        UUID doctorId,
        LocalDate startDate,
        LocalDate endDate,
        String reason,
        OffsetDateTime createdAt
) {}
