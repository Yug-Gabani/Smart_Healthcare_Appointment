package com.group6.healthcare.pharmacy.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.pharmacy.dto.AddToCartRequest;
import com.group6.healthcare.pharmacy.dto.CartResponse;
import com.group6.healthcare.pharmacy.dto.UpdateCartItemRequest;
import com.group6.healthcare.pharmacy.service.PharmacyCartService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pharmacy/cart")
@PreAuthorize("hasRole('PATIENT')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Pharmacy Cart", description = "Shopping cart management and automatic amount calculations")
public class PharmacyCartController {

    private final PharmacyCartService cartService;

    public PharmacyCartController(PharmacyCartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    @Operation(summary = "Get current user's shopping cart with computed subtotals and fees")
    public ApiResponse<CartResponse> getCart(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(cartService.getCartResponse(principal.getId()));
    }

    @PostMapping("/items")
    @Operation(summary = "Add medicine to cart (used by store and future AI Chatbot recommendation integration)")
    public ResponseEntity<ApiResponse<CartResponse>> addToCart(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody AddToCartRequest req
    ) {
        CartResponse updatedCart = cartService.addToCart(principal.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(updatedCart, "Medicine added to cart"));
    }

    @PutMapping("/items/{itemId}")
    @Operation(summary = "Update quantity of a cart item (removes item if quantity is 0)")
    public ApiResponse<CartResponse> updateItemQuantity(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateCartItemRequest req
    ) {
        return ApiResponse.ok(cartService.updateItemQuantity(principal.getId(), itemId, req));
    }

    @DeleteMapping("/items/{itemId}")
    @Operation(summary = "Remove an item from cart")
    public ApiResponse<CartResponse> removeItem(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID itemId
    ) {
        return ApiResponse.ok(cartService.removeItem(principal.getId(), itemId));
    }

    @DeleteMapping
    @Operation(summary = "Clear all items from cart")
    public ApiResponse<CartResponse> clearCart(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(cartService.clearCart(principal.getId()));
    }
}

