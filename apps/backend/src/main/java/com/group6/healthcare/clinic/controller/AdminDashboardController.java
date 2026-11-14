package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.clinic.dto.AdminAppointmentItemResponse;
import com.group6.healthcare.clinic.dto.AdminOverviewResponse;
import com.group6.healthcare.clinic.dto.AdminPaymentItemResponse;
import com.group6.healthcare.clinic.service.AdminDashboardService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin — Operations Dashboard", description = "Platform KPIs, executive overview, master appointments and finance ledger")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping("/overview")
    @Operation(summary = "Get platform overview stats, system health, and recent activities")
    public ApiResponse<AdminOverviewResponse> getOverview() {
        return ApiResponse.ok(adminDashboardService.getOverview());
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
}

