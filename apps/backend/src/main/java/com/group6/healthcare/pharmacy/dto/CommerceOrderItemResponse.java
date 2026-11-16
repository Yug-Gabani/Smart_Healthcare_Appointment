package com.group6.healthcare.pharmacy.dto;

import com.group6.healthcare.pharmacy.entity.PharmacyCommerceOrderItem;

import java.util.UUID;

public record CommerceOrderItemResponse(
        UUID id,
        UUID medicineId,
        String medicineName,
        Long unitPricePaise,
        Integer quantity,
        Long totalPaise
) {
    public static CommerceOrderItemResponse from(PharmacyCommerceOrderItem item) {
        return new CommerceOrderItemResponse(
                item.getId(),
                item.getMedicine() != null ? item.getMedicine().getId() : null,
                item.getMedicineName(),
                item.getUnitPricePaise(),
                item.getQuantity(),
                item.getTotalPaise()
        );
    }
}

