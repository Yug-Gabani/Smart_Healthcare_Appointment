package com.group6.healthcare.clinic.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;
import java.util.UUID;

/** One row of a doctor's weekly recurring availability. */
public record ScheduleTemplateDto(
        UUID id,
        @NotNull @Min(1) @Max(7) Integer dayOfWeek,  // 1=Mon ... 7=Sun (ISO)
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotNull @Min(15) @Max(60) Integer slotDurationMinutes
) {}
