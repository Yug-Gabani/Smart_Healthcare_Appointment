package com.group6.healthcare.pharmacy.dto;

import com.group6.healthcare.pharmacy.entity.Medicine;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MedicineResponse(
        UUID id,
        UUID categoryId,
        String categoryName,
        String name,
        String manufacturer,
        String description,
        String composition,
        String dosageInformation,
        String usageInstructions,
        Long pricePaise,
        Long discountedPricePaise,
        Integer stockQuantity,
        String imageUrl,
        boolean requiresPrescription,
        boolean active,
        OffsetDateTime createdAt
) {
    public static MedicineResponse from(Medicine m) {
        return new MedicineResponse(
                m.getId(),
                m.getCategory() != null ? m.getCategory().getId() : null,
                m.getCategory() != null ? m.getCategory().getName() : null,
                m.getName(),
                m.getManufacturer(),
                m.getDescription(),
                m.getComposition(),
                m.getDosageInformation(),
                m.getUsageInstructions(),
                m.getPricePaise(),
                m.getDiscountedPricePaise(),
                m.getStockQuantity(),
                m.getImageUrl(),
                m.isRequiresPrescription(),
                m.isActive(),
                m.getCreatedAt()
        );
    }
}

