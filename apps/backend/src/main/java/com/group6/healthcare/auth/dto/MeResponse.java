package com.group6.healthcare.auth.dto;

import com.group6.healthcare.user.entity.Role;

import java.util.UUID;

public record MeResponse(
        UUID id,
        String email,
        String fullName,
        String phone,
        Role role
) {}
