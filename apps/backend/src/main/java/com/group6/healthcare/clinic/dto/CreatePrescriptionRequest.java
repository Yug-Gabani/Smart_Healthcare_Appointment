package com.group6.healthcare.clinic.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreatePrescriptionRequest(
        @NotNull UUID appointmentId,
        String notes,
        @Min(1) @Max(365) Integer followUpAfterDays,
        @Size(max = 1000) String followUpNotes,
        @NotEmpty @Valid List<PrescriptionItemDto> items
) {}
