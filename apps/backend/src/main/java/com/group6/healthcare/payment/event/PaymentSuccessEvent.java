package com.group6.healthcare.payment.event;

import java.time.Instant;
import java.util.UUID;

public record PaymentSuccessEvent(
    UUID appointmentId,
    String userEmail,
    String patientName,
    String doctorName,
    Long amountPaise,
    String currency,
    String razorpayPaymentId,
    String razorpayOrderId,
    Instant timestamp,
    String phoneNumber,
    String slotTime
) {
    // Backward-compatible constructor defaulting slotTime if absent
    public PaymentSuccessEvent(
            UUID appointmentId,
            String userEmail,
            String patientName,
            String doctorName,
            Long amountPaise,
            String currency,
            String razorpayPaymentId,
            String razorpayOrderId,
            Instant timestamp,
            String phoneNumber) {
        this(appointmentId, userEmail, patientName, doctorName, amountPaise, currency,
             razorpayPaymentId, razorpayOrderId, timestamp, phoneNumber, "Today 02:00 PM");
    }
}

