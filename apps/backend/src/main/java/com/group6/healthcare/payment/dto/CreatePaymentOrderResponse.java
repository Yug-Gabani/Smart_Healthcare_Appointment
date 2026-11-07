package com.group6.healthcare.payment.dto;

import java.util.UUID;

public record CreatePaymentOrderResponse(
    UUID paymentOrderId,
    String razorpayOrderId,
    Long amountPaise,
    String currency,
    String keyId,
    String receipt,
    String status
) {}

