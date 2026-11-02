package com.group6.healthcare.clinic.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SlotResponse(
        UUID id,
        UUID doctorId,
        OffsetDateTime slotAt,
        boolean booked,
        boolean onHold,
        boolean heldByYou,
        Long remainingHoldSeconds
) {
    public SlotResponse(UUID id, UUID doctorId, OffsetDateTime slotAt, boolean booked) {
        this(id, doctorId, slotAt, booked, false, false, 0L);
    }
}
