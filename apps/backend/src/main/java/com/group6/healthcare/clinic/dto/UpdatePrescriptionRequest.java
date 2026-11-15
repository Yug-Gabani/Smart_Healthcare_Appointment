package com.group6.healthcare.clinic.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Edit a DRAFT prescription in place. Only allowed while status = DRAFT.
 * `items` fully replaces the previous list. Follow-up fields are optional
 * and can be cleared by sending null.
 */
public record UpdatePrescriptionRequest(
        String notes,
        @Min(1) @Max(365) Integer followUpAfterDays,
        @Size(max = 1000) String followUpNotes,
        @NotEmpty @Valid List<PrescriptionItemDto> items
) {}
