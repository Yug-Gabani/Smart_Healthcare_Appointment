package com.group6.healthcare.clinic.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record DoctorResponse(
        UUID id,
        String fullName,
        String specialty,
        String hospital,
        UUID hospitalId,
        String avatarUrl,
        BigDecimal rating,
        Integer reviewCount,
        String bio,
        List<SlotSummary> nextSlots,
        int openSlotCount
) {
    public record SlotSummary(UUID id, OffsetDateTime slotAt) {}

    public DoctorResponse(
            UUID id,
            String fullName,
            String specialty,
            String hospital,
            UUID hospitalId,
            String avatarUrl,
            BigDecimal rating,
            String bio,
            List<SlotSummary> nextSlots,
            int openSlotCount
    ) {
        this(id, fullName, specialty, hospital, hospitalId, avatarUrl, rating, 0, bio, nextSlots, openSlotCount);
    }
}
