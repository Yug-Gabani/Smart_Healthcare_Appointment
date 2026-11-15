package com.group6.healthcare.pharmacy.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record PharmacyCheckoutRequest(
        @NotBlank(message = "Delivery contact name is required")
        String deliveryName,

        @NotBlank(message = "Delivery contact phone is required")
        String deliveryPhone,

        @NotBlank(message = "Street address is required")
        String deliveryStreet,

        @NotBlank(message = "City is required")
        String deliveryCity,

        @NotBlank(message = "State is required")
        String deliveryState,

        @NotBlank(message = "Pincode is required")
        String deliveryPincode,

        UUID prescriptionId,

        String notes
) {}

