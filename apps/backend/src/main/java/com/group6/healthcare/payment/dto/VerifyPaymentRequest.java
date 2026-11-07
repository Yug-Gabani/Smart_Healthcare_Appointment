package com.group6.healthcare.payment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record VerifyPaymentRequest(
    @Schema(description = "Razorpay Order ID from create-order", example = "order_sb_sample12345", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank String razorpayOrderId,

    @Schema(description = "Razorpay Payment ID returned from client checkout", example = "pay_test_sample67890", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank String razorpayPaymentId,

    @Schema(description = "HMAC-SHA256 signature, or 'sandbox_signature' for sandbox testing", example = "sandbox_signature", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank String razorpaySignature
) {}
