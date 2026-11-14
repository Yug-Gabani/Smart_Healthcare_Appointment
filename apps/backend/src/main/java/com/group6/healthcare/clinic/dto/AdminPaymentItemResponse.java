package com.group6.healthcare.clinic.dto;

import java.time.Instant;
import java.util.UUID;

public record AdminPaymentItemResponse(
        UUID id,
        String razorpayOrderId,
        String razorpayPaymentId,
        UUID patientId,
        String patientName,
        UUID doctorId,
        String doctorName,
        UUID appointmentId,
        Long amountPaise,
        String status,
        Instant createdAt
) {}

