package com.group6.healthcare.clinic.dto;

import java.util.UUID;

public record SlotHoldResponse(
        UUID slotId,
        boolean success,
        boolean heldByYou,
        long remainingHoldSeconds,
        String message
) {}

