package com.group6.healthcare.pharmacy.dto;

import java.util.List;
import java.util.UUID;

public record CartResponse(
        UUID cartId,
        List<CartItemResponse> items,
        int totalItemsCount,
        long subtotalPaise,
        long discountPaise,
        long deliveryFeePaise,
        long totalPaise,
        boolean hasPrescriptionItems
) {}

