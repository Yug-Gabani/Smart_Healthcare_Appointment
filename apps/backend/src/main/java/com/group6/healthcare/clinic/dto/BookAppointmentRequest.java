package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.ConsultationType;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record BookAppointmentRequest(
        @NotNull UUID doctorId,
        @NotNull UUID slotId,
        UUID assessmentId,
        @NotNull ConsultationType consultationType,
        List<UUID> attachmentIds
) {}
