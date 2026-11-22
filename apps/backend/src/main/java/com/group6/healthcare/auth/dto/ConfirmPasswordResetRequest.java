package com.group6.healthcare.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ConfirmPasswordResetRequest(
        @NotBlank @Size(max = 256) String token,
        @NotBlank @Size(min = 8, max = 100)
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,100}$",
                message = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
        )
        String newPassword
) {}
