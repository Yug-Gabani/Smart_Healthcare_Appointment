package com.group6.healthcare.pharmacy.dto;

import com.group6.healthcare.pharmacy.entity.PharmacyCartItem;

import java.util.UUID;

public record CartItemResponse(
        UUID id,
        UUID medicineId,
        String medicineName,
        String manufacturer,
        String imageUrl,
        Long pricePaise,
        Long discountedPricePaise,
        Long effectivePricePaise,
        Integer quantity,
        Integer availableStock,
        boolean requiresPrescription,
        Long itemTotalPaise
) {
    public static CartItemResponse from(PharmacyCartItem item) {
        var m = item.getMedicine();
        long effPrice = (m.getDiscountedPricePaise() != null && m.getDiscountedPricePaise() > 0)
                ? m.getDiscountedPricePaise()
                : m.getPricePaise();
        long itemTotal = effPrice * item.getQuantity();

        return new CartItemResponse(
                item.getId(),
                m.getId(),
                m.getName(),
                m.getManufacturer(),
                m.getImageUrl(),
                m.getPricePaise(),
                m.getDiscountedPricePaise(),
                effPrice,
                item.getQuantity(),
                m.getStockQuantity(),
                m.isRequiresPrescription(),
                itemTotal
        );
    }
}

