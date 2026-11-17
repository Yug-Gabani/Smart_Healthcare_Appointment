package com.group6.healthcare.pharmacy.dto;

import com.group6.healthcare.pharmacy.entity.MedicineCategory;

import java.util.UUID;

public record MedicineCategoryResponse(
        UUID id,
        String name,
        String slug,
        String description,
        String icon,
        boolean active
) {
    public static MedicineCategoryResponse from(MedicineCategory c) {
        return new MedicineCategoryResponse(
                c.getId(),
                c.getName(),
                c.getSlug(),
                c.getDescription(),
                c.getIcon(),
                c.isActive()
        );
    }
}

