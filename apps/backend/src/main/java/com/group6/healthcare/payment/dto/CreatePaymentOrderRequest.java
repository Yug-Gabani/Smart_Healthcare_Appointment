package com.group6.healthcare.payment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreatePaymentOrderRequest(
    @Schema(description = "Amount in paise (₹500 = 50000 paise)", example = "50000", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull @Min(100) Long amountPaise,

    @Schema(description = "Full name of the patient", example = "Aarav Patel")
    String patientName,

    @Schema(description = "Email address for invoice and confirmation", example = "abhibrata.sarkar2020@gmail.com")
    String patientEmail,

    @Schema(description = "WhatsApp mobile phone number with country code", example = "+919876543210")
    String patientPhone,

    @Schema(description = "UUID of the specialist doctor", example = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
    UUID doctorId,

    @Schema(description = "UUID of the registered patient user (optional)", example = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22")
    UUID patientId,

    @Schema(description = "UUID of the booked appointment (optional)", example = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33")
    UUID appointmentId,

    @Schema(description = "Consultation appointment slot time", example = "Today 04:30 PM")
    String slotTime
) {
    public CreatePaymentOrderRequest(
            Long amountPaise,
            String patientName,
            String patientEmail,
            String patientPhone,
            UUID doctorId,
            String slotTime) {
        this(amountPaise, patientName, patientEmail, patientPhone, doctorId, null, null, slotTime);
    }
}
