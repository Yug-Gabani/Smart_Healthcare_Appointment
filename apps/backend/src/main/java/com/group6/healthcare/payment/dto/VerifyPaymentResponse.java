package com.group6.healthcare.payment.dto;

public record VerifyPaymentResponse(
    String status,
    String razorpayOrderId,
    String razorpayPaymentId
) {}

