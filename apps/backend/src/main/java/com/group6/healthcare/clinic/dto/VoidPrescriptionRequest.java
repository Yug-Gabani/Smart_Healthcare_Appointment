package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.NotBlank;

public record VoidPrescriptionRequest(@NotBlank String reason) {}
