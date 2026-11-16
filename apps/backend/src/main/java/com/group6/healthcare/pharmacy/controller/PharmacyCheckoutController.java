package com.group6.healthcare.pharmacy.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.pharmacy.dto.CommerceOrderResponse;
import com.group6.healthcare.pharmacy.dto.PharmacyCheckoutRequest;
import com.group6.healthcare.pharmacy.dto.PharmacyCheckoutResponse;
import com.group6.healthcare.pharmacy.dto.VerifyPharmacyPaymentRequest;
import com.group6.healthcare.pharmacy.service.PharmacyCommerceOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pharmacy/checkout")
@PreAuthorize("hasRole('PATIENT')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Pharmacy Checkout", description = "Initiate order checkout and verify Razorpay payment signatures")
public class PharmacyCheckoutController {

    private final PharmacyCommerceOrderService orderService;

    public PharmacyCheckoutController(PharmacyCommerceOrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/create-order")
    @Operation(summary = "Validate cart stock, calculate final amount, and generate Razorpay payment order")
    public ResponseEntity<ApiResponse<PharmacyCheckoutResponse>> createOrder(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody PharmacyCheckoutRequest req
    ) {
        PharmacyCheckoutResponse resp = orderService.createCheckoutOrder(principal.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(resp, "Pharmacy payment order created successfully"));
    }

    @PostMapping("/verify")
    @Operation(summary = "Cryptographically verify Razorpay payment HMAC-SHA256 signature and finalize order")
    public ResponseEntity<ApiResponse<CommerceOrderResponse>> verifyPayment(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody VerifyPharmacyPaymentRequest req
    ) {
        CommerceOrderResponse resp = orderService.verifyPayment(principal.getId(), req);
        return ResponseEntity.ok(ApiResponse.ok(resp, "Payment verified and pharmacy order confirmed"));
    }
}

