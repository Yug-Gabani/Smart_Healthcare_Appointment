package com.group6.healthcare.clinic.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.group6.healthcare.clinic.dto.AttachmentResponse;
import com.group6.healthcare.clinic.entity.TriageAttachment;
import com.group6.healthcare.clinic.repository.TriageAttachmentRepository;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Stores triage/appointment attachments.
 *
 * <p>Two modes, selected by whether a {@link Cloudinary} bean is present:
 * <ul>
 *   <li><b>Cloudinary</b> (prod / any env with {@code CLOUDINARY_*} set) — uploads the bytes to
 *       Cloudinary's object store and keeps the returned {@code secure_url} in {@code file_url}.
 *       Files survive container restarts, served via Cloudinary's CDN.</li>
 *   <li><b>Local disk</b> (dev fallback) — writes under {@code ./uploads} and exposes the file
 *       through {@code /api/v1/files/{filename}} like before.</li>
 * </ul>
 */
@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    private final Path uploadDir;
    private final TriageAttachmentRepository attachmentRepository;
    private final Optional<Cloudinary> cloudinary;
    private final String cloudinaryFolder;

    public FileStorageService(
            @Value("${app.upload.dir:uploads}") String uploadPath,
            @Value("${app.cloudinary.folder:pulsecare}") String cloudinaryFolder,
            TriageAttachmentRepository attachmentRepository,
            Optional<Cloudinary> cloudinary) {
        this.uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        this.attachmentRepository = attachmentRepository;
        this.cloudinary = cloudinary;
        this.cloudinaryFolder = cloudinaryFolder;

        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            // Only fatal when there's no remote backend to fall back on.
            if (cloudinary.isEmpty()) {
                throw new RuntimeException("Could not initialize upload directory: " + this.uploadDir, e);
            }
            log.warn("Could not initialize local upload dir ({}); continuing with Cloudinary only.",
                    e.getMessage());
        }

        if (cloudinary.isPresent()) {
            log.info("FileStorageService: Cloudinary storage ENABLED (folder: {}).", cloudinaryFolder);
        } else {
            log.info("FileStorageService: Cloudinary not configured, falling back to local disk at {}.",
                    this.uploadDir);
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

        String storedFileName;
        String fileUrl;
        if (cloudinary.isPresent()) {
            storedFileName = UUID.randomUUID().toString();
            fileUrl = uploadToCloudinary(file, storedFileName);
        } else {
            // Keep extension locally so content-type sniffing / direct download keeps working.
            String extension = "";
            int dotIdx = originalFilename.lastIndexOf('.');
            if (dotIdx >= 0) extension = originalFilename.substring(dotIdx).toLowerCase();
            storedFileName = UUID.randomUUID() + extension;
            fileUrl = uploadToLocalDisk(file, storedFileName);
        }

        String mimeType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        String normalizedCategory = (category != null && !category.isBlank())
                ? category.toUpperCase() : "SYMPTOM_IMAGE";

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

        return toResponse(attachmentRepository.save(attachment));
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

    // ---------- private helpers ----------

    @SuppressWarnings("unchecked")
    private String uploadToCloudinary(MultipartFile file, String publicId) {
        try {
            Map<String, Object> result = cloudinary.get().uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap(
                            "public_id",        cloudinaryFolder + "/" + publicId,
                            "resource_type",    "auto",       // handles images, PDFs, videos
                            "use_filename",     false,
                            "unique_filename",  false,
                            "overwrite",        false
                    ));
            Object secureUrl = result.get("secure_url");
            if (secureUrl == null) {
                throw new RuntimeException("Cloudinary upload returned no secure_url: " + result);
            }
            return secureUrl.toString();
        } catch (IOException e) {
            throw new RuntimeException("Cloudinary upload failed", e);
        }
    }

    private String uploadToLocalDisk(MultipartFile file, String storedFileName) {
        Path targetPath = this.uploadDir.resolve(storedFileName);
        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store uploaded file " + storedFileName, e);
        }
        return "/api/v1/files/" + storedFileName;
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
