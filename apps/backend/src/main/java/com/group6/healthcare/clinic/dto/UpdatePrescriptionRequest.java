package com.group6.healthcare.clinic.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Edit a DRAFT prescription in place. Only allowed while status = DRAFT.
 * `items` fully replaces the previous list.
 */
public record UpdatePrescriptionRequest(
        String notes,
        @NotEmpty @Valid List<PrescriptionItemDto> items
) {}
