package com.group6.healthcare.auth.dto;

import com.group6.healthcare.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Doctor-only fields ({@code specialty}, {@code hospitalName}, {@code hospitalId},
 * {@code registrationNumber}) are optional at the type level but validated inside
 * {@code AuthService.register} when {@code role == DOCTOR}.
 */
public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 100) String password,
        @NotBlank @Size(max = 255) String fullName,
        @Size(max = 50) String phone,
        @NotNull Role role,

        // ---------- doctor-only (ignored for other roles) ----------
        @Size(max = 128) String specialty,
        @Size(max = 256) String hospitalName,
        UUID hospitalId,
        @Size(max = 64) String registrationNumber
) {}
