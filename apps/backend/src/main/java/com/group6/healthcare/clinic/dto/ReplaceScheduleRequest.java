package com.group6.healthcare.clinic.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Bulk upsert: deletes all existing template rows for the doctor and inserts these. */
public record ReplaceScheduleRequest(
        @NotNull @Valid List<ScheduleTemplateDto> templates
) {}
