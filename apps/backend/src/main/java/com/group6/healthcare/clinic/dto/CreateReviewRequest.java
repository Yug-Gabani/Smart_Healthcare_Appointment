package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CreateReviewRequest(
        @Min(1) @Max(5) int rating,
        String comment,
        String tags,
        boolean isAnonymous
) {}
