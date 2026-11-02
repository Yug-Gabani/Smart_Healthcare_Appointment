package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejectDoctorRequest(
        @NotBlank @Size(max = 1000) String reason
) {}
