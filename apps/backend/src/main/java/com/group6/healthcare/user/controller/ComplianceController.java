package com.group6.healthcare.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.user.dto.DataExportResponse;
import com.group6.healthcare.user.service.ComplianceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/compliance")
@Tag(name = "Compliance & Privacy", description = "GDPR / HIPAA data export and account deletion compliance")
@SecurityRequirement(name = "bearerAuth")
public class ComplianceController {

    private final ComplianceService complianceService;
    private final ObjectMapper objectMapper;

    public ComplianceController(ComplianceService complianceService) {
        this.complianceService = complianceService;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    @GetMapping("/export")
    @PreAuthorize("hasRole('PATIENT') or hasRole('DOCTOR')")
    @Operation(summary = "Export all user health, consultation, and profile records (GDPR Art. 20)")
    public ResponseEntity<Resource> exportMyData(@AuthenticationPrincipal AppUserPrincipal principal) throws Exception {
        DataExportResponse export = complianceService.exportUserData(principal.getId());
        byte[] jsonBytes = objectMapper.writeValueAsString(export).getBytes(StandardCharsets.UTF_8);

        ByteArrayResource resource = new ByteArrayResource(jsonBytes);
        String filename = "pulsecare-data-export-" + System.currentTimeMillis() + ".json";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .contentLength(jsonBytes.length)
                .body(resource);
    }

    @DeleteMapping("/account")
    @PreAuthorize("hasRole('PATIENT') or hasRole('DOCTOR')")
    @Operation(summary = "Delete user account & credentials while preserving hospital clinical records")
    public ApiResponse<String> deleteMyAccount(@AuthenticationPrincipal AppUserPrincipal principal) {
        complianceService.deleteAccount(principal.getId());
        return ApiResponse.ok("Account deleted successfully. All credentials and personal PII have been erased.");
    }
}
