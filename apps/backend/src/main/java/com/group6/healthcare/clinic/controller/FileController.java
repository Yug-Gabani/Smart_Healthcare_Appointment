package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.AttachmentResponse;
import com.group6.healthcare.clinic.service.FileStorageService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/files")
@Tag(name = "Files & Attachments", description = "File upload for symptom images, prior prescriptions, and medical records")
public class FileController {

    private final FileStorageService fileStorageService;

    public FileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('PATIENT')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Upload a triage symptom photo, prior prescription, or lab report")
    public ResponseEntity<ApiResponse<AttachmentResponse>> upload(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", required = false, defaultValue = "SYMPTOM_IMAGE") String category,
            @RequestParam(value = "assessmentId", required = false) UUID assessmentId,
            @RequestParam(value = "appointmentId", required = false) UUID appointmentId) {

        AttachmentResponse response = fileStorageService.storeFile(
                principal.getId(),
                file,
                category,
                assessmentId,
                appointmentId
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response, "File uploaded successfully"));
    }

    @GetMapping("/{filename:.+}")
    @Operation(summary = "Download or view an uploaded medical attachment by filename")
    public ResponseEntity<Resource> getFile(@PathVariable String filename) {
        Resource file = fileStorageService.loadAsResource(filename);
        String contentType = null;
        try {
            contentType = Files.probeContentType(file.getFile().toPath());
        } catch (IOException ignored) {}

        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getFilename() + "\"")
                .body(file);
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('PATIENT')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List all attachments uploaded by the authenticated patient")
    public ApiResponse<List<AttachmentResponse>> myAttachments(
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(fileStorageService.getAttachmentsForPatient(principal.getId()));
    }
}
