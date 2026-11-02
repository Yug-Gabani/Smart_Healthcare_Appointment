package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.CancelOrderRequest;
import com.group6.healthcare.clinic.dto.PharmacyOrderResponse;
import com.group6.healthcare.clinic.entity.PharmacyOrderStatus;
import com.group6.healthcare.clinic.service.PharmacyOrderService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pharmacy/orders")
@PreAuthorize("hasRole('PHARMACIST')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Pharmacy", description = "Pharmacist-side order queue and lifecycle")
public class PharmacyController {

    private final PharmacyOrderService orderService;

    public PharmacyController(PharmacyOrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    @Operation(summary = "List orders by status (default: NEW)")
    public ApiResponse<List<PharmacyOrderResponse>> list(
            @RequestParam(name = "status", required = false, defaultValue = "NEW") PharmacyOrderStatus status) {
        return ApiResponse.ok(orderService.listByStatus(status));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one order with its prescription items + patient/doctor info")
    public ApiResponse<PharmacyOrderResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(orderService.getOne(id));
    }

    @PostMapping("/{id}/dispense")
    @Operation(summary = "Flip NEW → DISPENSED")
    public ApiResponse<PharmacyOrderResponse> dispense(@AuthenticationPrincipal AppUserPrincipal principal,
                                                        @PathVariable UUID id) {
        return ApiResponse.ok(orderService.dispense(principal.getId(), id));
    }

    @PostMapping("/{id}/pick-up")
    @Operation(summary = "Flip DISPENSED → PICKED_UP (terminal)")
    public ApiResponse<PharmacyOrderResponse> pickup(@AuthenticationPrincipal AppUserPrincipal principal,
                                                      @PathVariable UUID id) {
        return ApiResponse.ok(orderService.markPickedUp(principal.getId(), id));
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel an order (reason optional)")
    public ApiResponse<PharmacyOrderResponse> cancel(@AuthenticationPrincipal AppUserPrincipal principal,
                                                      @PathVariable UUID id,
                                                      @Valid @RequestBody(required = false) CancelOrderRequest req) {
        String reason = req == null ? null : req.reason();
        return ApiResponse.ok(orderService.cancelByPharmacist(principal.getId(), id, reason));
    }
}
