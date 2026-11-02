package com.group6.healthcare.clinic.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SlotResponse(
        UUID id,
        UUID doctorId,
        OffsetDateTime slotAt,
        boolean booked
) {}
