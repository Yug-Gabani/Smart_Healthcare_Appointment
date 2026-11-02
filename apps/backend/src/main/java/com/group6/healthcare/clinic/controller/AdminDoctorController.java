package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.RejectDoctorRequest;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.service.AdminDoctorService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/doctors")
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin — Doctor verification", description = "Approve or reject doctor sign-ups")
public class AdminDoctorController {

    private final AdminDoctorService adminDoctorService;

    public AdminDoctorController(AdminDoctorService adminDoctorService) {
        this.adminDoctorService = adminDoctorService;
    }

    @GetMapping
    @Operation(summary = "List doctors by status (default: PENDING)")
    public ApiResponse<List<DoctorMeResponse>> list(
            @RequestParam(name = "status", required = false, defaultValue = "PENDING") DoctorStatus status) {
        return ApiResponse.ok(adminDoctorService.listByStatus(status));
    }

    @PostMapping("/{doctorId}/approve")
    @Operation(summary = "Approve a doctor's profile — they become visible to patients")
    public ApiResponse<DoctorMeResponse> approve(@AuthenticationPrincipal AppUserPrincipal principal,
                                                  @PathVariable UUID doctorId) {
        return ApiResponse.ok(adminDoctorService.approve(doctorId, principal.getId()));
    }

    @PostMapping("/{doctorId}/reject")
    @Operation(summary = "Reject a doctor with a reason — they can edit and resubmit")
    public ApiResponse<DoctorMeResponse> reject(@AuthenticationPrincipal AppUserPrincipal principal,
                                                 @PathVariable UUID doctorId,
                                                 @Valid @RequestBody RejectDoctorRequest req) {
        return ApiResponse.ok(adminDoctorService.reject(doctorId, principal.getId(), req.reason()));
    }
}
