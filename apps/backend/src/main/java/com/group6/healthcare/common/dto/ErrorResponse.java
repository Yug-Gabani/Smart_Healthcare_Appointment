package com.group6.healthcare.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        int status,
        String error,
        String message,
        String path,
        List<FieldError> fieldErrors,
        Instant timestamp
) {
    public record FieldError(String field, String message) {}
}
