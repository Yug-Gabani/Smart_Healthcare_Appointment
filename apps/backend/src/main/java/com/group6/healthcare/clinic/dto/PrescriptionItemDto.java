package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.MealTiming;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

public record PrescriptionItemDto(
        UUID id,
        @NotBlank String drugName,
        @NotBlank String dose,
        @NotBlank String frequency,
        @NotBlank String duration,
        String instructions,
        /** One or more meal timings. If null/empty, treated as UNSPECIFIED. */
        List<MealTiming> mealTimings
) {}
