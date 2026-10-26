package com.group6.healthcare.auth.dto;

import com.group6.healthcare.user.entity.Role;

import java.util.UUID;

public record TokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long   expiresIn,
        UserSummary user
) {
    public record UserSummary(UUID id, String email, String fullName, Role role) {}
}
