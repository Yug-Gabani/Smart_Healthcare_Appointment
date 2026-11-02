package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.CreatePrescriptionRequest;
import com.group6.healthcare.clinic.dto.PrescriptionItemDto;
import com.group6.healthcare.clinic.dto.PrescriptionResponse;
import com.group6.healthcare.clinic.dto.UpdatePrescriptionRequest;
import com.group6.healthcare.clinic.dto.VoidPrescriptionRequest;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.MealTiming;
import com.group6.healthcare.clinic.entity.Prescription;
import com.group6.healthcare.clinic.entity.PrescriptionItem;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.PrescriptionItemRepository;
import com.group6.healthcare.clinic.repository.PrescriptionRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ConflictException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Lifecycle rules (DR-03 immutability enforced here):
 *  - DRAFT  -> create, edit, delete, sign; invisible to patient.
 *  - SIGNED -> immutable; visible to patient; can be VOIDED only (void creates a new row).
 *  - VOIDED -> created by voiding a SIGNED row; immutable; references the signed original.
 *
 * Only the doctor who owns the appointment may create/edit/sign/void.
 * At most one non-VOIDED prescription per appointment at a time.
 */
@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository itemRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                               PrescriptionItemRepository itemRepository,
                               AppointmentRepository appointmentRepository,
                               DoctorRepository doctorRepository,
                               UserRepository userRepository) {
        this.prescriptionRepository = prescriptionRepository;
        this.itemRepository = itemRepository;
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
    }

    // ===== commands =====

    @Transactional
    public PrescriptionResponse createDraft(UUID doctorUserId, CreatePrescriptionRequest req) {
        Doctor doctor = requireDoctor(doctorUserId);
        Appointment appt = appointmentRepository.findById(req.appointmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", req.appointmentId()));
        if (!appt.getDoctorId().equals(doctor.getId())) {
            throw new BusinessRuleException("Appointment belongs to a different doctor");
        }
        // "Active" means: a DRAFT exists, OR a SIGNED exists that has not been superseded by a
        // VOIDED record. A SIGNED whose id appears in some VOIDED.void_of is considered retired,
        // so a corrected prescription can be issued after voiding.
        List<Prescription> onAppt = prescriptionRepository.findByAppointmentIdOrderByCreatedAtAsc(appt.getId());
        if (onAppt.stream().anyMatch(p -> p.getStatus() == PrescriptionStatus.DRAFT)) {
            throw new ConflictException("A draft prescription is already in progress for this appointment. " +
                    "Finish or discard it before starting a new one.");
        }
        java.util.Set<UUID> voidedSignedIds = onAppt.stream()
                .filter(p -> p.getStatus() == PrescriptionStatus.VOIDED && p.getVoidOf() != null)
                .map(Prescription::getVoidOf)
                .collect(java.util.stream.Collectors.toSet());
        boolean activeSignedExists = onAppt.stream()
                .anyMatch(p -> p.getStatus() == PrescriptionStatus.SIGNED
                        && !voidedSignedIds.contains(p.getId()));
        if (activeSignedExists) {
            throw new ConflictException("An active signed prescription already exists for this appointment. " +
                    "Void it before writing a new one.");
        }

        Prescription rx = Prescription.builder()
                .appointmentId(appt.getId())
                .patientId(appt.getPatientId())
                .doctorId(doctor.getId())
                .status(PrescriptionStatus.DRAFT)
                .notes(req.notes())
                .build();
        rx = prescriptionRepository.save(rx);
        replaceItems(rx.getId(), req.items());
        return load(rx.getId(), doctor);
    }

    @Transactional
    public PrescriptionResponse updateDraft(UUID doctorUserId, UUID prescriptionId, UpdatePrescriptionRequest req) {
        Doctor doctor = requireDoctor(doctorUserId);
        Prescription rx = requireOwnedBy(doctor, prescriptionId);
        if (rx.getStatus() != PrescriptionStatus.DRAFT) {
            throw new BusinessRuleException("Only DRAFT prescriptions can be edited (status=" + rx.getStatus() + ")");
        }
        rx.setNotes(req.notes());
        prescriptionRepository.save(rx);
        replaceItems(rx.getId(), req.items());
        return load(rx.getId(), doctor);
    }

    @Transactional
    public PrescriptionResponse sign(UUID doctorUserId, UUID prescriptionId) {
        Doctor doctor = requireDoctor(doctorUserId);
        Prescription rx = requireOwnedBy(doctor, prescriptionId);
        if (rx.getStatus() != PrescriptionStatus.DRAFT) {
            throw new BusinessRuleException("Only DRAFT prescriptions can be signed (status=" + rx.getStatus() + ")");
        }
        if (itemRepository.findByPrescriptionIdOrderByPositionAsc(rx.getId()).isEmpty()) {
            throw new BusinessRuleException("Cannot sign an empty prescription");
        }
        rx.setStatus(PrescriptionStatus.SIGNED);
        rx.setSignedAt(OffsetDateTime.now());
        prescriptionRepository.save(rx);
        return load(rx.getId(), doctor);
    }

    @Transactional
    public PrescriptionResponse delete(UUID doctorUserId, UUID prescriptionId) {
        Doctor doctor = requireDoctor(doctorUserId);
        Prescription rx = requireOwnedBy(doctor, prescriptionId);
        if (rx.getStatus() != PrescriptionStatus.DRAFT) {
            throw new BusinessRuleException("Only DRAFT prescriptions can be deleted (status=" + rx.getStatus() + ")");
        }
        itemRepository.deleteByPrescriptionId(rx.getId());
        prescriptionRepository.delete(rx);
        // Return a synthetic "deleted" response so controller can echo the id.
        return new PrescriptionResponse(
                rx.getId(), rx.getAppointmentId(), rx.getPatientId(), null,
                rx.getDoctorId(), null, null, null,
                PrescriptionStatus.DRAFT, null, null, null,
                null, List.of(), rx.getCreatedAt(), OffsetDateTime.now());
    }

    @Transactional
    public PrescriptionResponse voidSigned(UUID doctorUserId, UUID prescriptionId, VoidPrescriptionRequest req) {
        Doctor doctor = requireDoctor(doctorUserId);
        Prescription original = requireOwnedBy(doctor, prescriptionId);
        if (original.getStatus() != PrescriptionStatus.SIGNED) {
            throw new BusinessRuleException("Only SIGNED prescriptions can be voided (status=" + original.getStatus() + ")");
        }
        // Create a NEW row of status=VOIDED pointing to the original. The original stays untouched.
        Prescription voidRecord = Prescription.builder()
                .appointmentId(original.getAppointmentId())
                .patientId(original.getPatientId())
                .doctorId(original.getDoctorId())
                .status(PrescriptionStatus.VOIDED)
                .voidOf(original.getId())
                .voidReason(req.reason())
                .notes(original.getNotes())
                .build();
        voidRecord = prescriptionRepository.save(voidRecord);
        // Copy items so the VOIDED record stands alone and the audit is self-contained.
        List<PrescriptionItem> originalItems = itemRepository.findByPrescriptionIdOrderByPositionAsc(original.getId());
        for (PrescriptionItem src : originalItems) {
            itemRepository.save(PrescriptionItem.builder()
                    .prescriptionId(voidRecord.getId())
                    .drugName(src.getDrugName())
                    .dose(src.getDose())
                    .frequency(src.getFrequency())
                    .duration(src.getDuration())
                    .instructions(src.getInstructions())
                    .position(src.getPosition())
                    .build());
        }
        return load(voidRecord.getId(), doctor);
    }

    // ===== queries =====

    @Transactional(readOnly = true)
    public PrescriptionResponse get(UUID prescriptionId, UUID patientScopeId, UUID doctorScopeUserId) {
        Prescription rx = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription", prescriptionId));
        if (patientScopeId != null) {
            if (!rx.getPatientId().equals(patientScopeId)) {
                throw new BusinessRuleException("Prescription belongs to a different patient");
            }
            if (rx.getStatus() == PrescriptionStatus.DRAFT) {
                // Drafts are doctor-only.
                throw new ResourceNotFoundException("Prescription", prescriptionId);
            }
        }
        if (doctorScopeUserId != null) {
            Doctor d = requireDoctor(doctorScopeUserId);
            if (!rx.getDoctorId().equals(d.getId())) {
                throw new BusinessRuleException("Prescription belongs to a different doctor");
            }
        }
        Doctor doctor = doctorRepository.findById(rx.getDoctorId()).orElse(null);
        return hydrate(rx, doctor);
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> listForPatient(UUID patientId) {
        return prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(patientId).stream()
                .filter(r -> r.getStatus() != PrescriptionStatus.DRAFT)
                .map(r -> hydrate(r, doctorRepository.findById(r.getDoctorId()).orElse(null)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> listForAppointment(UUID appointmentId, UUID patientScopeId, UUID doctorScopeUserId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));
        if (patientScopeId != null && !appt.getPatientId().equals(patientScopeId)) {
            throw new BusinessRuleException("Appointment belongs to a different patient");
        }
        if (doctorScopeUserId != null) {
            Doctor d = requireDoctor(doctorScopeUserId);
            if (!appt.getDoctorId().equals(d.getId())) {
                throw new BusinessRuleException("Appointment belongs to a different doctor");
            }
        }
        return prescriptionRepository.findByAppointmentIdOrderByCreatedAtAsc(appointmentId).stream()
                // Drafts hidden from patients
                .filter(r -> patientScopeId == null || r.getStatus() != PrescriptionStatus.DRAFT)
                .map(r -> hydrate(r, doctorRepository.findById(r.getDoctorId()).orElse(null)))
                .toList();
    }

    // ===== helpers =====

    private Doctor requireDoctor(UUID doctorUserId) {
        return doctorRepository.findByUserId(doctorUserId)
                .orElseThrow(() -> new BusinessRuleException("Signed-in user is not linked to a doctor profile"));
    }

    private Prescription requireOwnedBy(Doctor doctor, UUID prescriptionId) {
        Prescription rx = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription", prescriptionId));
        if (!rx.getDoctorId().equals(doctor.getId())) {
            throw new BusinessRuleException("Prescription belongs to a different doctor");
        }
        return rx;
    }

    private void replaceItems(UUID prescriptionId, List<PrescriptionItemDto> items) {
        itemRepository.deleteByPrescriptionId(prescriptionId);
        int i = 0;
        for (PrescriptionItemDto dto : items) {
            PrescriptionItem row = PrescriptionItem.builder()
                    .prescriptionId(prescriptionId)
                    .drugName(dto.drugName())
                    .dose(dto.dose())
                    .frequency(dto.frequency())
                    .duration(dto.duration())
                    .instructions(dto.instructions())
                    .position(i++)
                    .build();
            List<MealTiming> timings = dto.mealTimings();
            row.setMealTimingList(timings == null || timings.isEmpty()
                    ? List.of(MealTiming.UNSPECIFIED)
                    : timings);
            itemRepository.save(row);
        }
    }

    private PrescriptionResponse load(UUID prescriptionId, Doctor doctor) {
        Prescription rx = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription", prescriptionId));
        return hydrate(rx, doctor);
    }

    private PrescriptionResponse hydrate(Prescription rx, Doctor doctor) {
        User patient = userRepository.findById(rx.getPatientId()).orElse(null);
        List<PrescriptionItem> items = itemRepository.findByPrescriptionIdOrderByPositionAsc(rx.getId());
        List<PrescriptionItemDto> itemDtos = new ArrayList<>(items.size());
        for (PrescriptionItem it : items) {
            itemDtos.add(new PrescriptionItemDto(
                    it.getId(),
                    it.getDrugName(),
                    it.getDose(),
                    it.getFrequency(),
                    it.getDuration(),
                    it.getInstructions(),
                    it.getMealTimingList()
            ));
        }
        return new PrescriptionResponse(
                rx.getId(),
                rx.getAppointmentId(),
                rx.getPatientId(),
                patient != null ? patient.getFullName() : null,
                rx.getDoctorId(),
                doctor != null ? doctor.getFullName() : null,
                doctor != null ? doctor.getSpecialty() : null,
                doctor != null ? doctor.getHospital() : null,
                rx.getStatus(),
                rx.getSignedAt(),
                rx.getVoidOf(),
                rx.getVoidReason(),
                rx.getNotes(),
                Collections.unmodifiableList(itemDtos),
                rx.getCreatedAt(),
                rx.getUpdatedAt()
        );
    }
}
