package com.group6.healthcare.clinic.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SlotResponse(
        UUID id,
        UUID doctorId,
        OffsetDateTime slotAt,
        boolean booked,
        boolean available,
        boolean onHold,
        boolean heldByYou,
        Long remainingHoldSeconds
) {
    public SlotResponse(UUID id, UUID doctorId, OffsetDateTime slotAt, boolean booked) {
        this(id, doctorId, slotAt, booked, true, false, false, 0L);
    }

    public SlotResponse(UUID id, UUID doctorId, OffsetDateTime slotAt, boolean booked,
                        boolean onHold, boolean heldByYou, Long remainingHoldSeconds) {
        this(id, doctorId, slotAt, booked, true, onHold, heldByYou, remainingHoldSeconds);
    }
}
