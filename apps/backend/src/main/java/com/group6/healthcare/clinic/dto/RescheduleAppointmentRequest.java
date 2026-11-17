package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Patient-initiated reschedule: move the SAME appointment to a different slot on
 * the SAME doctor. Switching doctors mid-booking would reset urgency, price and
 * attachments, so it's deliberately not supported here — those patients cancel
 * and rebook.
 */
public record RescheduleAppointmentRequest(
        @NotNull UUID newSlotId
) {}
