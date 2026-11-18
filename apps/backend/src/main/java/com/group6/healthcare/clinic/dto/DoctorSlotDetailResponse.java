package com.group6.healthcare.clinic.dto;

import com.group6.healthcare.clinic.entity.AppointmentStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DoctorSlotDetailResponse(
        UUID id,
        UUID doctorId,
        OffsetDateTime slotAt,
        boolean booked,
        boolean available,
        UUID appointmentId,
        String patientName,
        AppointmentStatus appointmentStatus,
        boolean onLeave,
        String leaveReason
) {}
