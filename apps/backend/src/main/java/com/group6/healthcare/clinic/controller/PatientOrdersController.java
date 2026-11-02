package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.CancelOrderRequest;
import com.group6.healthcare.clinic.dto.CreateOrderRequest;
import com.group6.healthcare.clinic.dto.PharmacyOrderResponse;
import com.group6.healthcare.clinic.service.PharmacyOrderService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/me/orders")
@PreAuthorize("hasRole('PATIENT')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Patient orders", description = "Patient's opt-in pharmacy orders")
public class PatientOrdersController {

    private final PharmacyOrderService orderService;

    public PatientOrdersController(PharmacyOrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    @Operation(summary = "List my pharmacy orders (newest first)")
    public ApiResponse<List<PharmacyOrderResponse>> listMine(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(orderService.listMine(principal.getId()));
    }

    @PostMapping
    @Operation(summary = "Opt in to order a SIGNED prescription through PulseCare pharmacy")
    public ResponseEntity<ApiResponse<PharmacyOrderResponse>> create(@AuthenticationPrincipal AppUserPrincipal principal,
                                                                      @Valid @RequestBody CreateOrderRequest req) {
        PharmacyOrderResponse created = orderService.createOrder(principal.getId(), req.prescriptionId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created, "Order placed"));
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel my own NEW order")
    public ApiResponse<PharmacyOrderResponse> cancel(@AuthenticationPrincipal AppUserPrincipal principal,
                                                      @PathVariable UUID id,
                                                      @Valid @RequestBody(required = false) CancelOrderRequest req) {
        String reason = req == null ? null : req.reason();
        return ApiResponse.ok(orderService.cancelByPatient(principal.getId(), id, reason));
    }
}
