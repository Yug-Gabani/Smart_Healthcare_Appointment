package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.CreatePrescriptionRequest;
import com.group6.healthcare.clinic.dto.PrescriptionResponse;
import com.group6.healthcare.clinic.dto.UpdatePrescriptionRequest;
import com.group6.healthcare.clinic.dto.VoidPrescriptionRequest;
import com.group6.healthcare.clinic.service.PrescriptionPdfService;
import com.group6.healthcare.clinic.service.PrescriptionService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/prescriptions")
@Tag(name = "Prescriptions", description = "Draft/sign/void prescription lifecycle (FR-16, DR-03)")
@SecurityRequirement(name = "bearerAuth")
public class PrescriptionController {

    private final PrescriptionService prescriptionService;
    private final PrescriptionPdfService pdfService;

    public PrescriptionController(PrescriptionService prescriptionService,
                                  PrescriptionPdfService pdfService) {
        this.prescriptionService = prescriptionService;
        this.pdfService = pdfService;
    }

    @PostMapping
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Create a DRAFT prescription for an appointment")
    public ResponseEntity<ApiResponse<PrescriptionResponse>> create(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody CreatePrescriptionRequest req) {
        PrescriptionResponse resp = prescriptionService.createDraft(principal.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(resp, "Draft created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Edit a DRAFT prescription (items are replaced wholesale)")
    public ApiResponse<PrescriptionResponse> update(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePrescriptionRequest req) {
        return ApiResponse.ok(prescriptionService.updateDraft(principal.getId(), id, req), "Draft updated");
    }

    @PostMapping("/{id}/sign")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Sign a DRAFT prescription — becomes immutable (DR-03) and visible to the patient")
    public ApiResponse<PrescriptionResponse> sign(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id) {
        return ApiResponse.ok(prescriptionService.sign(principal.getId(), id), "Prescription signed");
    }

    @PostMapping("/{id}/void")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Void a SIGNED prescription (creates a new VOIDED record; original stays untouched)")
    public ApiResponse<PrescriptionResponse> voidRx(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody VoidPrescriptionRequest req) {
        return ApiResponse.ok(prescriptionService.voidSigned(principal.getId(), id, req), "Prescription voided");
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Delete a DRAFT prescription (SIGNED/VOIDED cannot be deleted)")
    public ApiResponse<PrescriptionResponse> delete(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id) {
        return ApiResponse.ok(prescriptionService.delete(principal.getId(), id), "Draft deleted");
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "List this patient's signed + voided prescriptions, most recent first")
    public ApiResponse<List<PrescriptionResponse>> mine(
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(prescriptionService.listForPatient(principal.getId()));
    }

    @GetMapping
    @Operation(summary = "List prescriptions for an appointment (doctor: all; patient: signed/voided only)")
    public ApiResponse<List<PrescriptionResponse>> listForAppointment(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam("appointmentId") UUID appointmentId) {
        boolean isPatient = "PATIENT".equals(principal.getRole());
        return ApiResponse.ok(prescriptionService.listForAppointment(
                appointmentId,
                isPatient ? principal.getId() : null,
                isPatient ? null : principal.getId()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Fetch a single prescription (patients see their own non-DRAFT records)")
    public ApiResponse<PrescriptionResponse> get(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id) {
        boolean isPatient = "PATIENT".equals(principal.getRole());
        return ApiResponse.ok(prescriptionService.get(
                id,
                isPatient ? principal.getId() : null,
                isPatient ? null : principal.getId()));
    }

    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Download prescription as PDF")
    public ResponseEntity<byte[]> pdf(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id) {
        boolean isPatient = "PATIENT".equals(principal.getRole());
        PrescriptionResponse rx = prescriptionService.get(
                id,
                isPatient ? principal.getId() : null,
                isPatient ? null : principal.getId());
        byte[] bytes = pdfService.render(rx);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"prescription-" + id + ".pdf\"")
                .body(bytes);
    }
}
