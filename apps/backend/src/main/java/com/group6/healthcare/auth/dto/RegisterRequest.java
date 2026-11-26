package com.group6.healthcare.auth.dto;

import com.group6.healthcare.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Doctor-only fields ({@code specialty}, {@code hospitalName}, {@code hospitalId},
 * {@code registrationNumber}) are optional at the type level but validated inside
 * {@code AuthService.register} when {@code role == DOCTOR}.
 */
public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 100)
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,100}$",
                message = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
        )
        String password,
        @NotBlank @Size(max = 255) String fullName,
        @Size(max = 50)
        @Pattern(
                regexp = "^(?:\\+?[0-9](?:[\\s\\-()]{0,2}[0-9]){6,14})?$",
                message = "Please enter a valid phone number (7-15 digits, optional + prefix)"
        )
        String phone,
        @NotNull Role role,

        // ---------- doctor-only (ignored for other roles) ----------
        @Size(max = 128) String specialty,
        @Size(max = 256) String hospitalName,
        UUID hospitalId,
        @Size(max = 64) String registrationNumber
) {}
