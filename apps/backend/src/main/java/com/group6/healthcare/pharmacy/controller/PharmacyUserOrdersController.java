package com.group6.healthcare.pharmacy.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.pharmacy.dto.CommerceOrderResponse;
import com.group6.healthcare.pharmacy.service.PharmacyCommerceOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pharmacy/me/orders")
@PreAuthorize("hasRole('PATIENT')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Pharmacy Customer Orders", description = "Customer order history and details")
public class PharmacyUserOrdersController {

    private final PharmacyCommerceOrderService orderService;

    public PharmacyUserOrdersController(PharmacyCommerceOrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    @Operation(summary = "List all pharmacy purchase orders for the authenticated customer (newest first)")
    public ApiResponse<List<CommerceOrderResponse>> listOrders(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(orderService.getUserOrders(principal.getId()));
    }

    @GetMapping("/{orderId}")
    @Operation(summary = "Get detailed information for a specific customer pharmacy order")
    public ApiResponse<CommerceOrderResponse> getOrder(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID orderId
    ) {
        return ApiResponse.ok(orderService.getOrderDetails(principal.getId(), orderId));
    }
}

