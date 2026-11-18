package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateDoctorLeaveRequest(
        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate,

        String reason
) {}
