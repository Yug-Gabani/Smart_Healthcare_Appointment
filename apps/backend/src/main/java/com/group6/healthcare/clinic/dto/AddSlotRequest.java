package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public record AddSlotRequest(
        @NotNull OffsetDateTime slotAt
) {}
