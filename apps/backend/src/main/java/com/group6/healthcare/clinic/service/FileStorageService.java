package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.AttachmentResponse;
import com.group6.healthcare.clinic.entity.TriageAttachment;
import com.group6.healthcare.clinic.repository.TriageAttachmentRepository;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path uploadDir;
    private final TriageAttachmentRepository attachmentRepository;

    public FileStorageService(
            @Value("${app.upload.dir:uploads}") String uploadPath,
            TriageAttachmentRepository attachmentRepository) {
        this.uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        this.attachmentRepository = attachmentRepository;
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize upload directory: " + this.uploadDir, e);
        }
    }

    @Transactional
    public AttachmentResponse storeFile(
            UUID patientId,
            MultipartFile file,
            String category,
            UUID assessmentId,
            UUID appointmentId) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload an empty file");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "attachment_" + System.currentTimeMillis();
        }

        // Sanitize extension
        String extension = "";
        int dotIdx = originalFilename.lastIndexOf('.');
        if (dotIdx >= 0) {
            extension = originalFilename.substring(dotIdx).toLowerCase();
        }

        String storedFileName = UUID.randomUUID() + extension;
        Path targetPath = this.uploadDir.resolve(storedFileName);

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store uploaded file " + storedFileName, e);
        }

        String fileUrl = "/api/v1/files/" + storedFileName;
        String mimeType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        String normalizedCategory = (category != null && !category.isBlank()) ? category.toUpperCase() : "SYMPTOM_IMAGE";

        TriageAttachment attachment = TriageAttachment.builder()
                .patientId(patientId)
                .assessmentId(assessmentId)
                .appointmentId(appointmentId)
                .fileName(originalFilename)
                .storedFileName(storedFileName)
                .fileUrl(fileUrl)
                .fileCategory(normalizedCategory)
                .mimeType(mimeType)
                .fileSizeBytes(file.getSize())
                .build();

        TriageAttachment saved = attachmentRepository.save(attachment);
        return toResponse(saved);
    }

    public Resource loadAsResource(String filename) {
        try {
            Path file = this.uploadDir.resolve(filename).normalize();
            if (!file.startsWith(this.uploadDir)) {
                throw new IllegalArgumentException("Access to path outside upload directory is forbidden");
            }
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new ResourceNotFoundException("File", filename);
            }
        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("File", filename);
        }
    }

    public List<AttachmentResponse> getAttachmentsForAppointment(UUID appointmentId) {
        return attachmentRepository.findByAppointmentId(appointmentId).stream()
                .map(this::toResponse)
                .toList();
    }

    public List<AttachmentResponse> getAttachmentsForAssessment(UUID assessmentId) {
        return attachmentRepository.findByAssessmentId(assessmentId).stream()
                .map(this::toResponse)
                .toList();
    }

    public List<AttachmentResponse> getAttachmentsForPatient(UUID patientId) {
        return attachmentRepository.findByPatientIdOrderByCreatedAtDesc(patientId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void linkAttachmentsToAppointment(List<UUID> attachmentIds, UUID appointmentId) {
        if (attachmentIds == null || attachmentIds.isEmpty()) return;
        List<TriageAttachment> attachments = attachmentRepository.findByIdIn(attachmentIds);
        for (TriageAttachment a : attachments) {
            a.setAppointmentId(appointmentId);
        }
        attachmentRepository.saveAll(attachments);
    }

    private AttachmentResponse toResponse(TriageAttachment a) {
        return new AttachmentResponse(
                a.getId(),
                a.getPatientId(),
                a.getAssessmentId(),
                a.getAppointmentId(),
                a.getFileName(),
                a.getFileUrl(),
                a.getFileCategory(),
                a.getMimeType(),
                a.getFileSizeBytes(),
                a.getCreatedAt()
        );
    }
}
