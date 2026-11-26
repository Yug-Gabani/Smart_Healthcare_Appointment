package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.clinic.dto.AdminAnalyticsResponse;
import com.group6.healthcare.clinic.service.AdminAnalyticsService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin — Analytics & Exports", description = "Platform analytics charts and CSV export endpoints")
public class AdminAnalyticsController {

    private final AdminAnalyticsService analyticsService;

    public AdminAnalyticsController(AdminAnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/analytics")
    @Operation(summary = "Get platform analytics: monthly revenue, top specialties, cancellation metrics")
    public ApiResponse<AdminAnalyticsResponse> getAnalytics() {
        return ApiResponse.ok(analyticsService.getAnalytics());
    }

    @GetMapping("/export/appointments")
    @Operation(summary = "Stream all appointments as a date-filtered CSV (memory-safe)")
    public ResponseEntity<StreamingResponseBody> exportAppointmentsCsv(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        String filename = buildFilename("appointments", startDate, endDate);
        StreamingResponseBody body = analyticsService.streamAppointmentsCsv(startDate, endDate);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    @GetMapping("/export/payments")
    @Operation(summary = "Stream all payment transactions as a date-filtered CSV (memory-safe)")
    public ResponseEntity<StreamingResponseBody> exportPaymentsCsv(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        String filename = buildFilename("payments", startDate, endDate);
        StreamingResponseBody body = analyticsService.streamPaymentsCsv(startDate, endDate);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    private static String buildFilename(String prefix, String start, String end) {
        StringBuilder sb = new StringBuilder(prefix);
        if (start != null && !start.isBlank()) sb.append("_from_").append(start);
        if (end != null && !end.isBlank()) sb.append("_to_").append(end);
        sb.append(".csv");
        return sb.toString();
    }
}
