package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.Urgency;
import jakarta.validation.constraints.NotNull;

/**
 * Discriminated-union payload for doctor actions on an appointment.
 * `urgency` + `reason` are only read for OVERRIDE; `notes` is appended on COMPLETE.
 */
public record PatchAppointmentRequest(
        @NotNull Action action,
        Urgency urgency,
        String reason,
        String notes
) {
    public enum Action {
        ACCEPT,          // BOOKED -> CONFIRMED
        START,           // CONFIRMED -> CONFIRMED  (reserved for a future "in-progress" marker)
        COMPLETE,        // BOOKED/CONFIRMED -> COMPLETED
        NO_SHOW,         // BOOKED/CONFIRMED -> NO_SHOW
        OVERRIDE_URGENCY // changes urgency + records clinician reason, status untouched
    }
}
