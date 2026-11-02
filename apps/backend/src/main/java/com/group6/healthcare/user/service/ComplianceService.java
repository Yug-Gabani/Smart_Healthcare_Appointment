package com.group6.healthcare.user.service;

import com.group6.healthcare.auth.repository.RefreshTokenRepository;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorReview;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.Prescription;
import com.group6.healthcare.clinic.entity.TriageAssessment;
import com.group6.healthcare.clinic.entity.TriageAttachment;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorReviewRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.repository.PrescriptionRepository;
import com.group6.healthcare.clinic.repository.TriageAssessmentRepository;
import com.group6.healthcare.clinic.repository.TriageAttachmentRepository;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.dto.DataExportResponse;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ComplianceService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorSlotRepository slotRepository;
    private final DoctorRepository doctorRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final TriageAssessmentRepository triageAssessmentRepository;
    private final TriageAttachmentRepository triageAttachmentRepository;
    private final DoctorReviewRepository doctorReviewRepository;

    public ComplianceService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            AppointmentRepository appointmentRepository,
            DoctorSlotRepository slotRepository,
            DoctorRepository doctorRepository,
            PrescriptionRepository prescriptionRepository,
            TriageAssessmentRepository triageAssessmentRepository,
            TriageAttachmentRepository triageAttachmentRepository,
            DoctorReviewRepository doctorReviewRepository) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.appointmentRepository = appointmentRepository;
        this.slotRepository = slotRepository;
        this.doctorRepository = doctorRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.triageAssessmentRepository = triageAssessmentRepository;
        this.triageAttachmentRepository = triageAttachmentRepository;
        this.doctorReviewRepository = doctorReviewRepository;
    }

    @Transactional(readOnly = true)
    public DataExportResponse exportUserData(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // Appointments
        List<Appointment> appts = appointmentRepository.findByPatientIdOrderByCreatedAtDesc(userId);
        List<UUID> docIds = appts.stream().map(Appointment::getDoctorId).distinct().toList();
        Map<UUID, Doctor> docsById = doctorRepository.findAllById(docIds).stream()
                .collect(Collectors.toMap(Doctor::getId, d -> d));

        List<Map<String, Object>> apptData = appts.stream().map(a -> {
            Doctor doc = docsById.get(a.getDoctorId());
            Map<String, Object> map = new HashMap<>();
            map.put("appointmentId", a.getId());
            map.put("status", a.getStatus().name());
            map.put("consultationType", a.getConsultationType().name());
            map.put("urgency", a.getUrgency().name());
            map.put("chiefComplaint", a.getChiefComplaint());
            map.put("doctorName", doc != null ? doc.getFullName() : null);
            map.put("doctorSpecialty", doc != null ? doc.getSpecialty() : null);
            map.put("hospital", doc != null ? doc.getHospital() : null);
            map.put("notes", a.getNotes());
            map.put("createdAt", a.getCreatedAt());
            return map;
        }).toList();

        // Prescriptions
        List<Prescription> rxList = prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> rxData = rxList.stream().map(p -> {
            Map<String, Object> map = new HashMap<>();
            map.put("prescriptionId", p.getId());
            map.put("appointmentId", p.getAppointmentId());
            map.put("status", p.getStatus().name());
            // TODO: diagnosis is not a field on Prescription in the current schema;
            // medications live in prescription_items. Export left as null here until the
            // compliance export is wired to prescription_items via PrescriptionItemRepository.
            map.put("diagnosis", null);
            map.put("notes", p.getNotes());
            map.put("medicationsJson", null);
            map.put("createdAt", p.getCreatedAt());
            return map;
        }).toList();

        // Triage Assessments
        List<TriageAssessment> assessments = triageAssessmentRepository.findByPatientIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> triageData = assessments.stream().map(t -> {
            Map<String, Object> map = new HashMap<>();
            map.put("assessmentId", t.getId());
            map.put("chiefComplaint", t.getChiefComplaint());
            map.put("urgency", t.getUrgency().name());
            map.put("suggestedSpecialty", t.getSuggestedSpecialty());
            map.put("rationale", t.getRationale());
            map.put("durationDays", t.getDurationDays());
            map.put("painLevel", t.getPainLevel());
            map.put("symptomsJson", t.getSymptomsJson());
            map.put("createdAt", t.getCreatedAt());
            return map;
        }).toList();

        // Attachments
        List<TriageAttachment> attachments = triageAttachmentRepository.findByPatientIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> attachmentData = attachments.stream().map(f -> {
            Map<String, Object> map = new HashMap<>();
            map.put("attachmentId", f.getId());
            map.put("fileName", f.getFileName());
            map.put("fileCategory", f.getFileCategory());
            map.put("fileUrl", f.getFileUrl());
            map.put("fileSizeBytes", f.getFileSizeBytes());
            map.put("createdAt", f.getCreatedAt());
            return map;
        }).toList();

        // Reviews
        List<DoctorReview> reviews = doctorReviewRepository.findByPatientIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> reviewData = reviews.stream().map(r -> {
            Map<String, Object> map = new HashMap<>();
            map.put("reviewId", r.getId());
            map.put("doctorId", r.getDoctorId());
            map.put("rating", r.getRating());
            map.put("comment", r.getComment());
            map.put("tags", r.getTags());
            map.put("isAnonymous", r.isAnonymous());
            map.put("createdAt", r.getCreatedAt());
            return map;
        }).toList();

        Map<String, String> address = new HashMap<>();
        address.put("street", user.getAddressStreet());
        address.put("city", user.getAddressCity());
        address.put("state", user.getAddressState());
        address.put("pincode", user.getAddressPincode());

        Map<String, String> emergency = new HashMap<>();
        emergency.put("name", user.getEmergencyContactName());
        emergency.put("phone", user.getEmergencyContactPhone());

        return new DataExportResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getPhone(),
                user.getGender(),
                user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null,
                address,
                emergency,
                user.getCreatedAt(),
                OffsetDateTime.now(),
                apptData,
                rxData,
                triageData,
                attachmentData,
                reviewData
        );
    }

    /**
     * Account Deletion per Healthcare Compliance:
     * - The user account and login credentials are permanently destroyed.
     * - Personal PII (phone, address, emergency contact) is scrubbed.
     * - Upcoming open appointments are cancelled and the doctor slots are freed.
     * - Refresh tokens and active sessions are revoked.
     * - In hospital records: Historical consultation and prescription logs remain intact
     *   for clinical record retention requirements.
     */
    @Transactional
    public void deleteAccount(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // 1. Cancel upcoming appointments and free slots
        List<Appointment> upcoming = appointmentRepository.findByPatientIdOrderByCreatedAtDesc(userId).stream()
                .filter(a -> a.getStatus() == AppointmentStatus.BOOKED || a.getStatus() == AppointmentStatus.CONFIRMED)
                .toList();

        for (Appointment a : upcoming) {
            a.setStatus(AppointmentStatus.CANCELLED);
            a.setNotes("Cancelled automatically due to patient account closure");
            slotRepository.findById(a.getSlotId()).ifPresent(slot -> {
                slot.setBooked(false);
                slotRepository.save(slot);
            });
        }
        appointmentRepository.saveAll(upcoming);

        // 2. Revoke all refresh tokens
        refreshTokenRepository.revokeAllForUser(userId);

        // 3. Scrub auth credentials and contact PII while retaining hospital clinical archive
        user.setEnabled(false);
        user.setDeleted(true);
        user.setDeletedAt(OffsetDateTime.now());
        user.setEmail("deleted_" + user.getId() + "@anonymized.pulsecare.local");
        user.setPasswordHash("ACCOUNT_DELETED_" + UUID.randomUUID());
        user.setPhone(null);
        user.setAddressStreet(null);
        user.setAddressCity(null);
        user.setAddressState(null);
        user.setAddressPincode(null);
        user.setEmergencyContactName(null);
        user.setEmergencyContactPhone(null);
        // Retain patient clinical name in hospital medical record per compliance requirement
        // (Do not erase so hospital & doctor records show the patient's medical history)

        userRepository.save(user);
    }
}
