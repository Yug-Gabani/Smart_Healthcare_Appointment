package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.AppointmentResponse;
import com.group6.healthcare.clinic.dto.AttachmentResponse;
import com.group6.healthcare.clinic.dto.BookAppointmentRequest;
import com.group6.healthcare.clinic.dto.PatchAppointmentRequest;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.TriageAssessment;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.repository.TriageAssessmentRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ConflictException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.payment.service.RefundService;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorSlotRepository slotRepository;
    private final TriageAssessmentRepository triageRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    @Autowired(required = false)
    private RefundService refundService;

    @Autowired(required = false)
    private RedisSlotReservationService redisSlotReservationService;

    public AppointmentService(AppointmentRepository appointmentRepository,
                              DoctorRepository doctorRepository,
                              DoctorSlotRepository slotRepository,
                              TriageAssessmentRepository triageRepository,
                              UserRepository userRepository,
                              FileStorageService fileStorageService) {
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.slotRepository = slotRepository;
        this.triageRepository = triageRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public AppointmentResponse book(UUID patientId, BookAppointmentRequest req) {
        Doctor doctor = doctorRepository.findById(req.doctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", req.doctorId()));

        // Pessimistic lock prevents two patients racing on the same slot row.
        DoctorSlot slot = slotRepository.findForUpdate(req.slotId())
                .orElseThrow(() -> new ResourceNotFoundException("Slot", req.slotId()));

        if (!slot.getDoctorId().equals(doctor.getId())) {
            throw new BusinessRuleException("Slot does not belong to the selected doctor");
        }
        if (slot.isBooked()) {
            throw new ConflictException("Slot already booked");
        }

        // Redis 2-Phase Concurrency Guard: Check if slot has an active soft hold by another patient
        if (redisSlotReservationService != null && !redisSlotReservationService.isSlotAvailableForPatient(req.slotId(), patientId)) {
            RedisSlotReservationService.HoldMetadata holdMeta = redisSlotReservationService.getHoldMetadata(req.slotId(), patientId);
            throw new ConflictException(String.format(
                    "Slot is currently reserved by another patient (expires in %ds). Please choose another slot.",
                    holdMeta.remainingSeconds()));
        }

        TriageAssessment assessment = null;
        if (req.assessmentId() != null) {
            assessment = triageRepository.findById(req.assessmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("TriageAssessment", req.assessmentId()));
            if (!assessment.getPatientId().equals(patientId)) {
                throw new BusinessRuleException("Triage assessment belongs to a different patient");
            }
        }

        slot.setBooked(true);
        slotRepository.save(slot);

        Urgency urgency = assessment != null ? assessment.getUrgency() : Urgency.ROUTINE;
        String complaint = assessment != null ? assessment.getChiefComplaint() : null;

        Appointment appt = Appointment.builder()
                .patientId(patientId)
                .doctorId(doctor.getId())
                .slotId(slot.getId())
                .assessmentId(assessment != null ? assessment.getId() : null)
                .consultationType(req.consultationType())
                .urgency(urgency)
                .status(AppointmentStatus.BOOKED)
                .chiefComplaint(complaint)
                .build();
        appt = appointmentRepository.save(appt);

        // Phase 2: Hard Commit completed — release Redis soft reservation
        if (redisSlotReservationService != null) {
            redisSlotReservationService.releaseHold(slot.getId(), patientId);
        }

        if (req.attachmentIds() != null && !req.attachmentIds().isEmpty()) {
            fileStorageService.linkAttachmentsToAppointment(req.attachmentIds(), appt.getId());
        }

        User patient = userRepository.findById(patientId).orElse(null);
        return toResponse(appt, doctor, slot, patient);
    }

    @Transactional
    public List<AppointmentResponse> listForPatient(UUID patientId) {
        List<Appointment> appointments = appointmentRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        return hydrate(appointments, patientId, null);
    }

    public enum DoctorQueueScope { ACTIVE, PAST, ALL }

    @Transactional
    public List<AppointmentResponse> listForDoctor(UUID doctorUserId, DoctorQueueScope scope) {
        return doctorRepository.findByUserId(doctorUserId)
                .map(doctor -> {
                    List<AppointmentStatus> statuses = switch (scope) {
                        case ACTIVE -> List.of(AppointmentStatus.BOOKED, AppointmentStatus.CONFIRMED);
                        case PAST   -> List.of(AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW,
                                               AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED);
                        case ALL    -> List.of(AppointmentStatus.BOOKED, AppointmentStatus.CONFIRMED,
                                               AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW,
                                               AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED);
                    };
                    List<Appointment> appointments = appointmentRepository
                            .findByDoctorIdAndStatusInOrderByCreatedAtDesc(doctor.getId(), statuses);
                    return hydrate(appointments, null, doctor.getId());
                })
                .orElseGet(List::of);
    }

    /** Backwards-compatible overload — defaults to the active queue. */
    @Transactional(readOnly = true)
    public List<AppointmentResponse> listForDoctor(UUID doctorUserId) {
        return listForDoctor(doctorUserId, DoctorQueueScope.ACTIVE);
    }

    /**
     * Doctor-side action on their own appointment. Fails fast on illegal transitions and
     * on cross-doctor access. OVERRIDE_URGENCY records the clinician's reason in `notes`
     * (prepended) so DR-16 traceability is preserved without a separate audit column.
     */
    @Transactional
    public AppointmentResponse doctorAction(UUID doctorUserId,
                                            UUID appointmentId,
                                            PatchAppointmentRequest req) {
        Doctor doctor = doctorRepository.findByUserId(doctorUserId)
                .orElseThrow(() -> new BusinessRuleException("Signed-in user is not linked to a doctor profile"));

        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));
        if (!appt.getDoctorId().equals(doctor.getId())) {
            throw new BusinessRuleException("Appointment belongs to a different doctor");
        }
        if (appt.getStatus() == AppointmentStatus.CANCELLED) {
            throw new BusinessRuleException("Cannot act on a cancelled appointment");
        }

        switch (req.action()) {
            case ACCEPT -> {
                if (appt.getStatus() != AppointmentStatus.BOOKED) {
                    throw new BusinessRuleException("Only BOOKED appointments can be accepted (was "
                            + appt.getStatus() + ")");
                }
                appt.setStatus(AppointmentStatus.CONFIRMED);
            }
            case START -> {
                if (appt.getStatus() == AppointmentStatus.COMPLETED
                        || appt.getStatus() == AppointmentStatus.NO_SHOW
                        || appt.getStatus() == AppointmentStatus.EXPIRED) {
                    throw new BusinessRuleException("Appointment is already " + appt.getStatus());
                }
                appt.setStatus(AppointmentStatus.CONFIRMED);
            }
            case COMPLETE -> {
                if (appt.getStatus() == AppointmentStatus.COMPLETED
                        || appt.getStatus() == AppointmentStatus.NO_SHOW
                        || appt.getStatus() == AppointmentStatus.EXPIRED) {
                    throw new BusinessRuleException("Appointment is already " + appt.getStatus());
                }
                appt.setStatus(AppointmentStatus.COMPLETED);
            }
            case NO_SHOW -> {
                if (appt.getStatus() == AppointmentStatus.COMPLETED
                        || appt.getStatus() == AppointmentStatus.NO_SHOW
                        || appt.getStatus() == AppointmentStatus.EXPIRED) {
                    throw new BusinessRuleException("Appointment is already " + appt.getStatus());
                }
                appt.setStatus(AppointmentStatus.NO_SHOW);
            }
            case OVERRIDE_URGENCY -> {
                if (req.urgency() == null) {
                    throw new BusinessRuleException("OVERRIDE_URGENCY requires `urgency`");
                }
                if (req.reason() == null || req.reason().isBlank()) {
                    throw new BusinessRuleException("OVERRIDE_URGENCY requires a `reason`");
                }
                Urgency previous = appt.getUrgency();
                appt.setUrgency(req.urgency());
                String displayName = doctor.getFullName();
                if (displayName != null && displayName.toLowerCase().startsWith("dr. ")) {
                    displayName = displayName.substring(4);
                }
                String stamp = String.format("[OVERRIDE %s→%s by Dr. %s] %s",
                        previous, req.urgency(), displayName, req.reason());
                appt.setNotes(appt.getNotes() == null ? stamp : stamp + "\n" + appt.getNotes());
            }
        }

        if (req.notes() != null && !req.notes().isBlank() && req.action() != PatchAppointmentRequest.Action.OVERRIDE_URGENCY) {
            String addition = "[" + req.action() + "] " + req.notes();
            appt.setNotes(appt.getNotes() == null ? addition : appt.getNotes() + "\n" + addition);
        }

        appointmentRepository.save(appt);

        DoctorSlot slot = slotRepository.findById(appt.getSlotId()).orElse(null);
        User patient = userRepository.findById(appt.getPatientId()).orElse(null);
        return toResponse(appt, doctor, slot, patient);
    }

    @Transactional
    public AppointmentResponse cancel(UUID patientId, UUID appointmentId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));
        if (!appt.getPatientId().equals(patientId)) {
            throw new BusinessRuleException("Appointment belongs to a different patient");
        }
        if (appt.getStatus() == AppointmentStatus.CANCELLED
                || appt.getStatus() == AppointmentStatus.COMPLETED
                || appt.getStatus() == AppointmentStatus.NO_SHOW
                || appt.getStatus() == AppointmentStatus.EXPIRED) {
            throw new BusinessRuleException("Appointment cannot be cancelled from status " + appt.getStatus());
        }

        if (refundService != null) {
            refundService.processCancelAndRefund(appointmentId, patientId, null);
            Appointment updated = appointmentRepository.findById(appointmentId).orElse(appt);
            Doctor doctor = doctorRepository.findById(updated.getDoctorId()).orElse(null);
            DoctorSlot slot = slotRepository.findById(updated.getSlotId()).orElse(null);
            User patient = userRepository.findById(patientId).orElse(null);
            return toResponse(updated, doctor, slot, patient);
        }

        appt.setStatus(AppointmentStatus.CANCELLED);
        appointmentRepository.save(appt);

        // free the slot
        slotRepository.findById(appt.getSlotId()).ifPresent(s -> {
            s.setBooked(false);
            slotRepository.save(s);
        });

        Doctor doctor = doctorRepository.findById(appt.getDoctorId()).orElse(null);
        DoctorSlot slot = slotRepository.findById(appt.getSlotId()).orElse(null);
        User patient = userRepository.findById(patientId).orElse(null);
        return toResponse(appt, doctor, slot, patient);
    }

    /**
     * Patient-initiated reschedule: same appointment, new slot on the same doctor.
     * Pessimistically locks BOTH slot rows (old and new) and swaps atomically.
     * Fails fast if the new slot belongs to a different doctor, is already booked,
     * is in the past, or is held by another patient (Redis soft hold).
     *
     * <p>The appointment is reset to {@link AppointmentStatus#BOOKED} because
     * doctor-side confirmation attached to the old time doesn't carry over to the
     * new time. Cancellation/refund state is left untouched — an already cancelled
     * appointment cannot be rescheduled.</p>
     */
    @Transactional
    public AppointmentResponse reschedule(UUID patientId, UUID appointmentId, UUID newSlotId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));
        if (!appt.getPatientId().equals(patientId)) {
            throw new BusinessRuleException("Appointment belongs to a different patient");
        }
        if (appt.getStatus() != AppointmentStatus.BOOKED
                && appt.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new BusinessRuleException(
                    "Only booked or confirmed appointments can be rescheduled (current status: "
                            + appt.getStatus() + ")");
        }
        if (newSlotId.equals(appt.getSlotId())) {
            throw new BusinessRuleException("New slot must be different from the current slot");
        }

        DoctorSlot oldSlot = slotRepository.findForUpdate(appt.getSlotId())
                .orElseThrow(() -> new ResourceNotFoundException("Slot", appt.getSlotId()));
        if (oldSlot.getSlotAt() != null
                && oldSlot.getSlotAt().isBefore(java.time.OffsetDateTime.now())) {
            throw new BusinessRuleException("Cannot reschedule — original slot has already started");
        }

        DoctorSlot newSlot = slotRepository.findForUpdate(newSlotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", newSlotId));
        if (!newSlot.getDoctorId().equals(appt.getDoctorId())) {
            throw new BusinessRuleException(
                    "New slot must belong to the same doctor. Cancel and rebook to switch doctors.");
        }
        if (newSlot.isBooked()) {
            throw new ConflictException("New slot is already booked");
        }
        if (newSlot.getSlotAt() != null
                && newSlot.getSlotAt().isBefore(java.time.OffsetDateTime.now())) {
            throw new BusinessRuleException("New slot is in the past");
        }

        if (redisSlotReservationService != null
                && !redisSlotReservationService.isSlotAvailableForPatient(newSlotId, patientId)) {
            RedisSlotReservationService.HoldMetadata holdMeta =
                    redisSlotReservationService.getHoldMetadata(newSlotId, patientId);
            throw new ConflictException(String.format(
                    "New slot is currently reserved by another patient (expires in %ds). " +
                            "Please choose another slot.",
                    holdMeta.remainingSeconds()));
        }

        oldSlot.setBooked(false);
        slotRepository.save(oldSlot);

        newSlot.setBooked(true);
        slotRepository.save(newSlot);

        appt.setSlotId(newSlot.getId());
        appt.setStatus(AppointmentStatus.BOOKED);
        appt.setRescheduleCount(appt.getRescheduleCount() + 1);
        appt.setLastRescheduledAt(java.time.OffsetDateTime.now());

        String stamp = "[RESCHEDULED #" + appt.getRescheduleCount() + " by patient]";
        appt.setNotes(appt.getNotes() == null ? stamp : stamp + "\n" + appt.getNotes());

        appointmentRepository.save(appt);

        if (redisSlotReservationService != null) {
            redisSlotReservationService.releaseHold(newSlotId, patientId);
        }

        Doctor doctor = doctorRepository.findById(appt.getDoctorId()).orElse(null);
        User patient = userRepository.findById(patientId).orElse(null);
        return toResponse(appt, doctor, newSlot, patient);
    }

    /**
     * Patient books a doctor-recommended follow-up. The doctor must be the same
     * one who saw the original appointment; the new row links back to that
     * original via {@code parent_appointment_id} so clinical continuity is
     * navigable from either end.
     */
    @Transactional
    public AppointmentResponse bookFollowUp(UUID patientId,
                                            UUID originalAppointmentId,
                                            UUID slotId,
                                            com.group6.healthcare.clinic.entity.ConsultationType consultationType) {
        Appointment original = appointmentRepository.findById(originalAppointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", originalAppointmentId));
        if (!original.getPatientId().equals(patientId)) {
            throw new BusinessRuleException("Original appointment belongs to a different patient");
        }
        if (original.getStatus() != AppointmentStatus.COMPLETED) {
            throw new BusinessRuleException(
                    "A follow-up can only be booked from a completed consultation");
        }

        Doctor doctor = doctorRepository.findById(original.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", original.getDoctorId()));

        DoctorSlot slot = slotRepository.findForUpdate(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", slotId));
        if (!slot.getDoctorId().equals(doctor.getId())) {
            throw new BusinessRuleException("Slot does not belong to the recommending doctor");
        }
        if (slot.isBooked()) {
            throw new ConflictException("Slot already booked");
        }
        if (slot.getSlotAt() != null
                && slot.getSlotAt().isBefore(java.time.OffsetDateTime.now())) {
            throw new BusinessRuleException("Slot is in the past");
        }
        if (redisSlotReservationService != null
                && !redisSlotReservationService.isSlotAvailableForPatient(slotId, patientId)) {
            RedisSlotReservationService.HoldMetadata holdMeta =
                    redisSlotReservationService.getHoldMetadata(slotId, patientId);
            throw new ConflictException(String.format(
                    "Slot is currently reserved by another patient (expires in %ds).",
                    holdMeta.remainingSeconds()));
        }

        slot.setBooked(true);
        slotRepository.save(slot);

        Urgency urgency = original.getUrgency();
        String complaint = original.getChiefComplaint() == null
                ? "Follow-up visit" : "Follow-up — " + original.getChiefComplaint();

        Appointment followUp = Appointment.builder()
                .patientId(patientId)
                .doctorId(doctor.getId())
                .slotId(slot.getId())
                .consultationType(consultationType)
                .urgency(urgency)
                .status(AppointmentStatus.BOOKED)
                .chiefComplaint(complaint)
                .parentAppointmentId(original.getId())
                .notes("[FOLLOW-UP of appointment " + original.getId() + "]")
                .build();
        followUp = appointmentRepository.save(followUp);

        if (redisSlotReservationService != null) {
            redisSlotReservationService.releaseHold(slotId, patientId);
        }

        User patient = userRepository.findById(patientId).orElse(null);
        return toResponse(followUp, doctor, slot, patient);
    }

    @Transactional
    public AppointmentResponse get(UUID appointmentId, UUID patientId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));
        if (patientId != null && !appt.getPatientId().equals(patientId)) {
            throw new BusinessRuleException("Appointment belongs to a different patient");
        }
        Doctor doctor = doctorRepository.findById(appt.getDoctorId()).orElse(null);
        DoctorSlot slot = slotRepository.findById(appt.getSlotId()).orElse(null);
        User patient = userRepository.findById(appt.getPatientId()).orElse(null);

        // Auto-expire elapsed appointments
        if (appt.getStatus() == AppointmentStatus.BOOKED || appt.getStatus() == AppointmentStatus.CONFIRMED) {
            if (slot != null && slot.getSlotAt() != null && slot.getSlotAt().plusMinutes(45).isBefore(java.time.OffsetDateTime.now())) {
                appt.setStatus(AppointmentStatus.EXPIRED);
                appointmentRepository.save(appt);
            }
        }

        return toResponse(appt, doctor, slot, patient);
    }

    private List<AppointmentResponse> hydrate(List<Appointment> appointments,
                                              UUID forcedPatientId,
                                              UUID forcedDoctorId) {
        if (appointments.isEmpty()) return List.of();

        List<UUID> doctorIds = appointments.stream().map(Appointment::getDoctorId).distinct().toList();
        Map<UUID, Doctor> doctorsById = doctorRepository.findAllById(doctorIds).stream()
                .collect(java.util.stream.Collectors.toMap(Doctor::getId, d -> d));

        List<UUID> slotIds = appointments.stream().map(Appointment::getSlotId).distinct().toList();
        Map<UUID, DoctorSlot> slotsById = slotRepository.findAllById(slotIds).stream()
                .collect(java.util.stream.Collectors.toMap(DoctorSlot::getId, s -> s));

        List<UUID> patientIds = appointments.stream().map(Appointment::getPatientId).distinct().toList();
        Map<UUID, User> patientsById = userRepository.findAllById(patientIds).stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u));

        // Auto-expire appointments whose scheduled consultation window (+45 mins) has elapsed
        java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
        List<Appointment> modified = new java.util.ArrayList<>();
        for (Appointment a : appointments) {
            if (a.getStatus() == AppointmentStatus.BOOKED || a.getStatus() == AppointmentStatus.CONFIRMED) {
                DoctorSlot s = slotsById.get(a.getSlotId());
                if (s != null && s.getSlotAt() != null && s.getSlotAt().plusMinutes(45).isBefore(now)) {
                    a.setStatus(AppointmentStatus.EXPIRED);
                    modified.add(a);
                }
            }
        }
        if (!modified.isEmpty()) {
            appointmentRepository.saveAll(modified);
        }

        return appointments.stream()
                .map(a -> toResponse(
                        a,
                        doctorsById.get(a.getDoctorId()),
                        slotsById.get(a.getSlotId()),
                        patientsById.get(a.getPatientId())))
                .toList();
    }

    private AppointmentResponse toResponse(Appointment a, Doctor doctor, DoctorSlot slot, User patient) {
        List<AttachmentResponse> attachments = fileStorageService.getAttachmentsForAppointment(a.getId());
        return new AppointmentResponse(
                a.getId(),
                a.getPatientId(),
                patient != null ? patient.getFullName() : null,
                a.getDoctorId(),
                doctor != null ? doctor.getFullName() : null,
                doctor != null ? doctor.getSpecialty() : null,
                doctor != null ? doctor.getHospital() : null,
                doctor != null ? doctor.getAvatarUrl() : null,
                a.getSlotId(),
                slot != null ? slot.getSlotAt() : null,
                a.getAssessmentId(),
                a.getConsultationType(),
                a.getUrgency(),
                a.getStatus(),
                a.getChiefComplaint(),
                a.getNotes(),
                a.getCreatedAt(),
                a.getUpdatedAt(),
                attachments,
                a.getCancellationReason(),
                a.getCancelledAt(),
                a.getRefundPercentage(),
                a.getRefundAmountPaise(),
                a.getRescheduleCount(),
                a.getLastRescheduledAt(),
                a.getParentAppointmentId()
        );
    }
}
