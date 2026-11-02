package com.group6.healthcare.clinic.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record CreatePrescriptionRequest(
        @NotNull UUID appointmentId,
        String notes,
        @NotEmpty @Valid List<PrescriptionItemDto> items
) {}
