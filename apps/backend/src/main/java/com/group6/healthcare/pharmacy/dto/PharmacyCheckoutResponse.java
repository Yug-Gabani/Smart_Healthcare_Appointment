package com.group6.healthcare.pharmacy.dto;

import java.util.UUID;

public record PharmacyCheckoutResponse(
        UUID orderId,
        String orderNumber,
        String razorpayOrderId,
        Long amountPaise,
        String currency,
        String keyId,
        String orderStatus,
        String paymentStatus
) {}

