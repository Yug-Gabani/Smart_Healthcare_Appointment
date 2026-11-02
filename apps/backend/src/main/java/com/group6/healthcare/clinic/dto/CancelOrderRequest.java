package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.Size;

public record CancelOrderRequest(
        @Size(max = 500) String reason
) {}
