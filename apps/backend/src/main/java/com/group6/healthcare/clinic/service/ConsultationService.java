package com.group6.healthcare.clinic.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.clinic.dto.ConsultationEndRequest;
import com.group6.healthcare.clinic.dto.ConsultationSessionResponse;
import com.group6.healthcare.clinic.dto.ConsultationSignalMessage;
import com.group6.healthcare.clinic.dto.DoctorReviewSummaryRequest;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.ConsultationSession;
import com.group6.healthcare.clinic.entity.ConsultationSessionStatus;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.ConsultationSessionRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
public class ConsultationService {

    private static final Logger log = LoggerFactory.getLogger(ConsultationService.class);

    private final ConsultationSessionRepository sessionRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorSlotRepository slotRepository;
    private final UserRepository userRepository;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    @Value("${app.ai.service-url:http://localhost:8001}")
    private String aiServiceUrl;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    // In-memory signaling bus for peer-to-peer WebRTC SDP & ICE candidate exchange.
    // Key: appointmentId, Value: synchronized list of recent signal messages with monotonic timestamps.
    private final Map<UUID, List<ConsultationSignalMessage>> signalQueues = new ConcurrentHashMap<>();
    private final AtomicLong lastSignalTimestamp = new AtomicLong(0);

    public ConsultationService(
            ConsultationSessionRepository sessionRepository,
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            DoctorSlotRepository slotRepository,
            UserRepository userRepository) {
        this.sessionRepository = sessionRepository;
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.slotRepository = slotRepository;
        this.userRepository = userRepository;
        this.restClient = RestClient.builder().build();
        this.objectMapper = new ObjectMapper();
    }

    @Transactional
    public ConsultationSessionResponse getOrCreateSession(UUID appointmentId, UUID requesterId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));

        if (appt.getConsultationType() != ConsultationType.VIDEO) {
            throw new BusinessRuleException("Appointment " + appointmentId + " is an in-person clinic visit, not a video consultation.");
        }

        // Verify that requester is either the patient or the doctor
        Doctor doctor = doctorRepository.findById(appt.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", appt.getDoctorId()));
        boolean isDoctor = doctor.getUserId().equals(requesterId);
        boolean isPatient = appt.getPatientId().equals(requesterId);

        if (!isDoctor && !isPatient) {
            throw new BusinessRuleException("You are not an authorized participant in this consultation.");
        }

        DoctorSlot slot = slotRepository.findById(appt.getSlotId())
                .orElseThrow(() -> new ResourceNotFoundException("Slot", appt.getSlotId()));

        User patientUser = userRepository.findById(appt.getPatientId()).orElse(null);
        User doctorUser = userRepository.findById(doctor.getUserId()).orElse(null);

        String patientName = patientUser != null ? patientUser.getFullName() : "Patient";
        String doctorName = doctorUser != null ? "Dr. " + doctorUser.getFullName() : "Doctor";

        ConsultationSession session = sessionRepository.findByAppointmentId(appointmentId)
                .orElseGet(() -> {
                    String roomId = "pc-room-" + appointmentId.toString().substring(0, 8);
                    ConsultationSession newSession = ConsultationSession.builder()
                            .appointmentId(appointmentId)
                            .roomId(roomId)
                            .status(ConsultationSessionStatus.SCHEDULED)
                            .doctorReviewed(false)
                            .patientConsentTranscription(false)
                            .doctorConsentTranscription(false)
                            .build();
                    return sessionRepository.save(newSession);
                });

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime slotAt = slot.getSlotAt();

        // Timing activation rule:
        // Room opens 30 mins before slotAt until slotAt + 12 hours.
        // Doctors have override capability to start the room at any time for testing/prep.
        // If doctor has already opened or started the room, or in dev/test environment, patient can join immediately.
        boolean inWindow = now.isAfter(slotAt.minusMinutes(30)) && now.isBefore(slotAt.plusHours(12));
        boolean roomAlreadyStarted = session.getStatus() == ConsultationSessionStatus.WAITING
                || session.getStatus() == ConsultationSessionStatus.IN_PROGRESS;
        boolean isDevOrTest = "dev".equalsIgnoreCase(activeProfile) || "test".equalsIgnoreCase(activeProfile);
        boolean canJoin = isDoctor || inWindow || roomAlreadyStarted || isDevOrTest;

        String joinMessage;
        if (session.getStatus() == ConsultationSessionStatus.COMPLETED) {
            joinMessage = "This consultation has concluded. The clinical summary is saved below.";
        } else if (canJoin) {
            joinMessage = "Consultation room is active. Click to join the video session.";
        } else {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("h:mm a");
            joinMessage = "Room activates 30 minutes before your scheduled slot (" + slotAt.format(formatter) + ").";
        }

        return toResponse(session, slotAt, doctorName, patientName, canJoin, joinMessage);
    }

    @Transactional
    public ConsultationSessionResponse startConsultation(UUID appointmentId, UUID requesterId) {
        ConsultationSessionResponse current = getOrCreateSession(appointmentId, requesterId);
        ConsultationSession session = sessionRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("ConsultationSession", appointmentId));

        if (session.getStatus() == ConsultationSessionStatus.SCHEDULED) {
            session.setStatus(ConsultationSessionStatus.WAITING);
        } else if (session.getStatus() == ConsultationSessionStatus.WAITING) {
            session.setStatus(ConsultationSessionStatus.IN_PROGRESS);
        }

        if (session.getStartedAt() == null) {
            session.setStartedAt(OffsetDateTime.now());
        }

        // Advance appointment to CONFIRMED if it was still BOOKED
        Appointment appt = appointmentRepository.findById(appointmentId).orElse(null);
        if (appt != null && appt.getStatus() == AppointmentStatus.BOOKED) {
            appt.setStatus(AppointmentStatus.CONFIRMED);
            appointmentRepository.save(appt);
        }

        session = sessionRepository.save(session);
        return getOrCreateSession(appointmentId, requesterId);
    }

    @Transactional
    public ConsultationSessionResponse endConsultation(UUID appointmentId, UUID requesterId, ConsultationEndRequest req) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));

        ConsultationSession session = sessionRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("ConsultationSession", appointmentId));

        Doctor doctor = doctorRepository.findById(appt.getDoctorId()).orElse(null);
        User patient = userRepository.findById(appt.getPatientId()).orElse(null);

        String chiefComplaint = appt.getChiefComplaint();
        if (chiefComplaint == null || chiefComplaint.isBlank()) {
            chiefComplaint = "Routine medical teleconsultation follow-up.";
        }

        String transcript = (req != null && req.transcript() != null) ? req.transcript() : "";
        String doctorNotes = (req != null && req.doctorNotes() != null) ? req.doctorNotes() : "";

        String patientName = patient != null ? patient.getFullName() : "Patient";
        String doctorName = doctor != null ? "Dr. " + doctor.getFullName() : "Doctor";

        // Update consent if explicitly submitted in end request
        if (req != null) {
            if (req.patientConsentTranscription() != null) {
                session.setPatientConsentTranscription(req.patientConsentTranscription());
            }
            if (req.doctorConsentTranscription() != null) {
                session.setDoctorConsentTranscription(req.doctorConsentTranscription());
            }
            if (session.getConsentTimestamp() == null) {
                session.setConsentTimestamp(OffsetDateTime.now());
            }
        }

        // Attempt LangChain + LangGraph AI Meeting Summarization via ai-service / OpenRouter
        AiSummaryResponse aiSummary = tryGenerateAiSummary(patientName, doctorName, chiefComplaint, transcript, doctorNotes);

        // Save raw AI advisory output into immutable column (DR-15, DR-16)
        if (aiSummary != null) {
            try {
                session.setAiSummaryRaw(objectMapper.writeValueAsString(aiSummary));
                session.setAiGeneratedAt(OffsetDateTime.now());
            } catch (Exception e) {
                log.warn("Failed to serialize raw AI summary payload: {}", e.getMessage());
            }
        }

        // Extract structured dimensions
        String reason = (aiSummary != null && aiSummary.reason_for_consultation() != null && !aiSummary.reason_for_consultation().isBlank())
                ? aiSummary.reason_for_consultation()
                : chiefComplaint;

        String patientSymptoms = (aiSummary != null && aiSummary.patient_reported_symptoms() != null && !aiSummary.patient_reported_symptoms().isBlank())
                ? aiSummary.patient_reported_symptoms()
                : (req != null && req.patientSymptoms() != null && !req.patientSymptoms().isBlank())
                ? req.patientSymptoms()
                : (transcript.isBlank() ? "No verbal transcript recorded during session." : "Symptoms discussed during live telehealth call.");

        String discussionPoints = (aiSummary != null && aiSummary.discussion_points() != null && !aiSummary.discussion_points().isBlank())
                ? aiSummary.discussion_points()
                : (req != null && req.discussionPoints() != null && !req.discussionPoints().isBlank())
                ? req.discussionPoints()
                : "Telehealth clinical review conducted between patient and clinician.";

        String observations = (aiSummary != null && aiSummary.doctor_observations_and_advice() != null && !aiSummary.doctor_observations_and_advice().isBlank())
                ? aiSummary.doctor_observations_and_advice()
                : (req != null && req.observations() != null && !req.observations().isBlank())
                ? req.observations()
                : "Visual assessment and symptom evaluation completed over secure video stream.";

        String advice = (aiSummary != null && aiSummary.doctor_advice() != null && !aiSummary.doctor_advice().isBlank())
                ? aiSummary.doctor_advice()
                : (req != null && req.doctorNotes() != null && !req.doctorNotes().isBlank())
                ? req.doctorNotes()
                : "Follow doctor advice and instructions discussed during the consultation.";

        String actions = (aiSummary != null && aiSummary.recommended_next_steps() != null && !aiSummary.recommended_next_steps().isBlank())
                ? aiSummary.recommended_next_steps()
                : (aiSummary != null && aiSummary.prescribed_actions() != null && !aiSummary.prescribed_actions().isBlank())
                ? aiSummary.prescribed_actions()
                : (req != null && req.prescribedActions() != null && !req.prescribedActions().isBlank())
                ? req.prescribedActions()
                : "Adhere to the digital prescription issued in the portal.";

        String followUp = (aiSummary != null && aiSummary.follow_up_recommendations() != null && !aiSummary.follow_up_recommendations().isBlank())
                ? aiSummary.follow_up_recommendations()
                : (aiSummary != null && aiSummary.follow_up() != null && !aiSummary.follow_up().isBlank())
                ? aiSummary.follow_up()
                : (req != null && req.followUp() != null && !req.followUp().isBlank())
                ? req.followUp()
                : "Schedule follow-up review in 7–10 days if symptoms persist. Seek immediate emergency care for red flag symptoms.";

        String missingInfo = (aiSummary != null && aiSummary.missing_information() != null && !aiSummary.missing_information().isBlank())
                ? aiSummary.missing_information()
                : "Detailed symptom timeline and vitals subject to attending doctor's direct clinical verification.";

        String communicationSummary = (aiSummary != null && aiSummary.communication_summary() != null && !aiSummary.communication_summary().isBlank())
                ? aiSummary.communication_summary()
                : "Video telehealth consultation conducted between " + patientName + " and " + doctorName + " for '" + chiefComplaint + "'.";

        session.setStatus(ConsultationSessionStatus.COMPLETED);
        session.setEndedAt(OffsetDateTime.now());
        session.setTranscript(transcript);
        session.setSummaryChiefComplaint(reason);
        session.setSummaryPatientSymptoms(patientSymptoms);
        session.setSummaryDiscussionPoints(discussionPoints);
        session.setSummaryObservations(communicationSummary + "\n\nClinical Observations: " + observations);
        session.setSummaryDoctorAdvice(advice);
        session.setSummaryPrescribedActions(actions);
        session.setSummaryFollowUp(followUp);
        session.setSummaryMissingInfo(missingInfo);

        // Mark as pending doctor review until the clinician confirms or edits it
        session.setDoctorReviewed(false);

        session = sessionRepository.save(session);

        // Advance appointment status to COMPLETED and record summary notes
        appt.setStatus(AppointmentStatus.COMPLETED);
        appt.setNotes(communicationSummary);
        appointmentRepository.save(appt);

        // Broadcast END_CALL message
        pushSignal(appointmentId, new ConsultationSignalMessage(
                "END_CALL",
                requesterId,
                doctor != null && doctor.getUserId().equals(requesterId) ? "DOCTOR" : "PATIENT",
                "Consultation completed by participant",
                System.currentTimeMillis()
        ));

        return getOrCreateSession(appointmentId, requesterId);
    }

    @Transactional
    public ConsultationSessionResponse reviewAndOverrideSummary(
            UUID appointmentId,
            UUID doctorUserId,
            DoctorReviewSummaryRequest req) {

        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));

        Doctor doctor = doctorRepository.findById(appt.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", appt.getDoctorId()));

        if (!doctor.getUserId().equals(doctorUserId)) {
            throw new BusinessRuleException("Only the attending doctor can review and confirm this consultation summary.");
        }

        ConsultationSession session = sessionRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("ConsultationSession", appointmentId));

        // Update clinician-verified fields
        if (req.chiefComplaint() != null && !req.chiefComplaint().isBlank()) {
            session.setSummaryChiefComplaint(req.chiefComplaint().trim());
        }
        if (req.patientSymptoms() != null && !req.patientSymptoms().isBlank()) {
            session.setSummaryPatientSymptoms(req.patientSymptoms().trim());
        }
        if (req.discussionPoints() != null && !req.discussionPoints().isBlank()) {
            session.setSummaryDiscussionPoints(req.discussionPoints().trim());
        }
        if (req.observations() != null && !req.observations().isBlank()) {
            session.setSummaryObservations(req.observations().trim());
        }
        if (req.doctorAdvice() != null && !req.doctorAdvice().isBlank()) {
            session.setSummaryDoctorAdvice(req.doctorAdvice().trim());
        }
        if (req.prescribedActions() != null && !req.prescribedActions().isBlank()) {
            session.setSummaryPrescribedActions(req.prescribedActions().trim());
        }
        if (req.followUp() != null && !req.followUp().isBlank()) {
            session.setSummaryFollowUp(req.followUp().trim());
        }
        if (req.missingInfo() != null && !req.missingInfo().isBlank()) {
            session.setSummaryMissingInfo(req.missingInfo().trim());
        }

        // Record clinician audit details (DR-15, DR-16)
        // Original AI advisory summary in session.aiSummaryRaw remains UNTOUCHED
        session.setDoctorReviewed(Boolean.TRUE.equals(req.confirmVerification()));
        session.setDoctorReviewedAt(OffsetDateTime.now());
        session.setDoctorReviewedBy(doctorUserId);
        session.setDoctorOverrideNotes(req.overrideNotes());

        session = sessionRepository.save(session);
        log.info("Clinician {} reviewed and verified summary for appointment {}", doctorUserId, appointmentId);

        // Notify connected peer that verified summary is ready
        pushSignal(appointmentId, new ConsultationSignalMessage(
                "SUMMARY_VERIFIED",
                doctorUserId,
                "DOCTOR",
                "Clinical summary verified by attending physician",
                System.currentTimeMillis()
        ));

        return getOrCreateSession(appointmentId, doctorUserId);
    }

    @Transactional
    public ConsultationSessionResponse recordConsent(
            UUID appointmentId,
            UUID requesterId,
            String requesterRole,
            boolean consent) {

        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));

        ConsultationSession session = sessionRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("ConsultationSession", appointmentId));

        if ("DOCTOR".equalsIgnoreCase(requesterRole)) {
            session.setDoctorConsentTranscription(consent);
        } else {
            session.setPatientConsentTranscription(consent);
        }

        session.setConsentTimestamp(OffsetDateTime.now());
        session = sessionRepository.save(session);

        // Broadcast CONSENT_STATE signal
        pushSignal(appointmentId, new ConsultationSignalMessage(
                "CONSENT_STATE",
                requesterId,
                requesterRole,
                String.format("{\"patientConsent\":%b,\"doctorConsent\":%b}",
                        session.isPatientConsentTranscription(),
                        session.isDoctorConsentTranscription()),
                System.currentTimeMillis()
        ));

        return getOrCreateSession(appointmentId, requesterId);
    }

    public void pushSignal(UUID appointmentId, ConsultationSignalMessage message) {
        long now = System.currentTimeMillis();
        long monotonicTs = lastSignalTimestamp.updateAndGet(prev -> Math.max(now, prev + 1));
        ConsultationSignalMessage stamped = new ConsultationSignalMessage(
                message.type(),
                message.senderId(),
                message.senderRole(),
                message.payload(),
                monotonicTs
        );
        signalQueues.compute(appointmentId, (k, list) -> {
            List<ConsultationSignalMessage> q = (list == null) ? Collections.synchronizedList(new ArrayList<>()) : list;
            long cutoff = System.currentTimeMillis() - 120_000; // retain for 2 minutes
            synchronized (q) {
                q.removeIf(m -> m.timestamp() < cutoff);
                q.add(stamped);
            }
            return q;
        });
    }

    public List<ConsultationSignalMessage> pollSignals(UUID appointmentId, UUID requesterId, long since) {
        List<ConsultationSignalMessage> q = signalQueues.get(appointmentId);
        if (q == null) return List.of();
        synchronized (q) {
            return q.stream()
                    .filter(m -> m.timestamp() > since && !requesterId.equals(m.senderId()))
                    .collect(Collectors.toList());
        }
    }

    private ConsultationSessionResponse toResponse(
            ConsultationSession s,
            OffsetDateTime slotAt,
            String doctorName,
            String patientName,
            boolean canJoin,
            String joinMessage) {
        return new ConsultationSessionResponse(
                s.getId(),
                s.getAppointmentId(),
                s.getRoomId(),
                s.getStatus(),
                canJoin,
                joinMessage,
                slotAt,
                doctorName,
                patientName,
                s.getStartedAt(),
                s.getEndedAt(),
                s.getTranscript(),
                s.getSummaryChiefComplaint(),
                s.getSummaryObservations(),
                s.getSummaryDoctorAdvice(),
                s.getSummaryPrescribedActions(),
                s.getSummaryFollowUp(),
                s.getCreatedAt(),
                s.getSummaryPatientSymptoms(),
                s.getSummaryDiscussionPoints(),
                s.getSummaryMissingInfo(),
                s.getAiSummaryRaw(),
                s.getAiGeneratedAt(),
                s.isDoctorReviewed(),
                s.getDoctorReviewedAt(),
                s.getDoctorOverrideNotes(),
                s.isPatientConsentTranscription(),
                s.isDoctorConsentTranscription(),
                s.getConsentTimestamp()
        );
    }

    private record AiSummaryPayload(
            String patient_name,
            String doctor_name,
            String chief_complaint,
            String transcript,
            String doctor_notes
    ) {}

    public record AiSummaryResponse(
            String reason_for_consultation,
            String patient_reported_symptoms,
            String discussion_points,
            String doctor_observations_and_advice,
            String recommended_next_steps,
            String follow_up_recommendations,
            String missing_information,
            String safety_disclaimer,
            // Legacy aliases
            String chief_complaint,
            String communication_summary,
            String observations,
            String doctor_advice,
            String prescribed_actions,
            String follow_up
    ) {}

    private AiSummaryResponse tryGenerateAiSummary(
            String patientName,
            String doctorName,
            String chiefComplaint,
            String transcript,
            String doctorNotes) {
        if (aiServiceUrl == null || aiServiceUrl.isBlank()) {
            return null;
        }
        try {
            String targetUri = aiServiceUrl.replaceAll("/$", "") + "/summarize-consultation";
            log.info("Requesting LangGraph consultation summary from: {}", targetUri);
            return restClient.post()
                    .uri(targetUri)
                    .body(new AiSummaryPayload(patientName, doctorName, chiefComplaint, transcript, doctorNotes))
                    .retrieve()
                    .body(AiSummaryResponse.class);
        } catch (Exception ex) {
            log.warn("AI meeting summarization fallback invoked ({}: {})", ex.getClass().getSimpleName(), ex.getMessage());
            return null;
        }
    }
}
