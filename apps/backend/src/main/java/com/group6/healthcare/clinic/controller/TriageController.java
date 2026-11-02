package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.TriageRequest;
import com.group6.healthcare.clinic.dto.TriageResponse;
import com.group6.healthcare.clinic.service.TriageService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/triage")
@Tag(name = "Triage", description = "Rule-based advisory triage (FR-05, FR-07, DR-15)")
@SecurityRequirement(name = "bearerAuth")
public class TriageController {

    private final TriageService triageService;

    public TriageController(TriageService triageService) {
        this.triageService = triageService;
    }

    @PostMapping("/assess")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Score a pre-visit intake and persist the advisory assessment")
    public ResponseEntity<ApiResponse<TriageResponse>> assess(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody TriageRequest req) {
        TriageResponse resp = triageService.assess(principal.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(resp, "Triage completed"));
    }
}
