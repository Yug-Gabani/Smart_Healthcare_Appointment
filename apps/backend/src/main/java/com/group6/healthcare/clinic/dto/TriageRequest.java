package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record TriageRequest(
        @NotBlank String chiefComplaint,
        List<String> symptoms,
        @NotNull @Min(0) @Max(180) Integer durationDays,
        @NotNull @Min(0) @Max(10)  Integer painLevel,
        boolean fever,
        boolean chestPain,
        boolean shortnessOfBreath
) {}
