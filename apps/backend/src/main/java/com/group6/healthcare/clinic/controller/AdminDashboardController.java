package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.clinic.dto.AdminAnalyticsResponse;
import com.group6.healthcare.clinic.dto.AdminAppointmentItemResponse;
import com.group6.healthcare.clinic.dto.AdminOverviewResponse;
import com.group6.healthcare.clinic.dto.AdminPaymentItemResponse;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.service.AdminDashboardService;
import com.group6.healthcare.clinic.service.AdminExportService;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.payment.entity.PaymentOrder;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin — Operations Dashboard", description = "Platform KPIs, executive overview, analytics, master appointments, finance ledger, and CSV exports")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;
    private final AdminExportService adminExportService;

    public AdminDashboardController(
            AdminDashboardService adminDashboardService,
            AdminExportService adminExportService) {
        this.adminDashboardService = adminDashboardService;
        this.adminExportService = adminExportService;
    }

    @GetMapping("/overview")
    @Operation(summary = "Get platform overview stats, system health, and recent activities")
    public ApiResponse<AdminOverviewResponse> getOverview() {
        return ApiResponse.ok(adminDashboardService.getOverview());
    }

    @GetMapping("/analytics")
    @Operation(summary = "Get monthly revenue, top specialties, and cancellation/no-show analytics")
    public ApiResponse<AdminAnalyticsResponse> getAnalytics(
            @RequestParam(defaultValue = "6") int months) {
        return ApiResponse.ok(adminDashboardService.getAnalytics(months));
    }

    @GetMapping("/appointments")
    @Operation(summary = "List all platform appointments for operations monitoring")
    public ApiResponse<List<AdminAppointmentItemResponse>> getAppointments() {
        return ApiResponse.ok(adminDashboardService.getAllAppointments());
    }

    @GetMapping("/payments")
    @Operation(summary = "List all platform financial payment transactions")
    public ApiResponse<List<AdminPaymentItemResponse>> getPayments() {
        return ApiResponse.ok(adminDashboardService.getAllPayments());
    }

    @GetMapping(value = "/exports/appointments.csv", produces = "text/csv; charset=UTF-8")
    @Operation(summary = "Stream date-filtered appointments audit report as CSV")
    public void exportAppointmentsCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) AppointmentStatus status,
            HttpServletResponse response) throws IOException {
        adminExportService.validateDateRange(from, to);
        response.setContentType("text/csv; charset=UTF-8");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"pulsecare-appointments-report.csv\"");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");

        Writer writer = new BufferedWriter(new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8));
        adminExportService.streamAppointmentsCsv(from, to, status, writer);
        writer.flush();
    }

    @GetMapping(value = "/exports/transactions.csv", produces = "text/csv; charset=UTF-8")
    @Operation(summary = "Stream date-filtered payment transactions audit report as CSV")
    public void exportTransactionsCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PaymentOrder.Status status,
            HttpServletResponse response) throws IOException {
        adminExportService.validateDateRange(from, to);
        response.setContentType("text/csv; charset=UTF-8");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"pulsecare-transactions-report.csv\"");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");

        Writer writer = new BufferedWriter(new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8));
        adminExportService.streamTransactionsCsv(from, to, status, writer);
        writer.flush();
    }
}

