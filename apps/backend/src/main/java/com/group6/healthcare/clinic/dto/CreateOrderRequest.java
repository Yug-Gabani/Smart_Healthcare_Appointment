package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateOrderRequest(
        @NotNull UUID prescriptionId
) {}
