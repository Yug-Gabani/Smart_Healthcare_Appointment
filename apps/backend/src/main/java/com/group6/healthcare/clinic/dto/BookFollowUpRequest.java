package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.ConsultationType;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Patient converts a doctor-recommended follow-up (from a prescription) into
 * a real booking. The backend infers {@code doctorId} from the original
 * appointment; the patient only picks a slot and video/in-person.
 */
public record BookFollowUpRequest(
        @NotNull UUID originalAppointmentId,
        @NotNull UUID slotId,
        @NotNull ConsultationType consultationType
) {}
