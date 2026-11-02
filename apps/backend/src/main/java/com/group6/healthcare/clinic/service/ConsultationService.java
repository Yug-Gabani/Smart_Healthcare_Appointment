package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.ConsultationEndRequest;
import com.group6.healthcare.clinic.dto.ConsultationSessionResponse;
import com.group6.healthcare.clinic.dto.ConsultationSignalMessage;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ConsultationService {

    private final ConsultationSessionRepository sessionRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorSlotRepository slotRepository;
    private final UserRepository userRepository;

    // In-memory signaling bus for peer-to-peer WebRTC SDP & ICE candidate exchange.
    // Key: appointmentId, Value: list of recent signal messages with timestamps.
    private final Map<UUID, List<ConsultationSignalMessage>> signalQueues = new ConcurrentHashMap<>();

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
                            .build();
                    return sessionRepository.save(newSession);
                });

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime slotAt = slot.getSlotAt();

        // Timing activation rule:
        // Room opens 15 mins before slotAt until slotAt + 2 hours.
        // Doctors have override capability to start the room at any time for testing/prep.
        boolean inWindow = now.isAfter(slotAt.minusMinutes(15)) && now.isBefore(slotAt.plusHours(2));
        boolean roomAlreadyStarted = session.getStatus() == ConsultationSessionStatus.WAITING
                || session.getStatus() == ConsultationSessionStatus.IN_PROGRESS;
        boolean canJoin = isDoctor || inWindow || roomAlreadyStarted;

        String joinMessage;
        if (session.getStatus() == ConsultationSessionStatus.COMPLETED) {
            joinMessage = "This consultation has concluded. The clinical summary is saved below.";
        } else if (canJoin) {
            joinMessage = "Consultation room is active. Click to join the video session.";
        } else {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("h:mm a");
            joinMessage = "Room activates 15 minutes before your scheduled slot (" + slotAt.format(formatter) + ").";
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

        // Build structured clinical summary
        String chiefComplaint = appt.getChiefComplaint();
        if (chiefComplaint == null || chiefComplaint.isBlank()) {
            chiefComplaint = "Routine medical teleconsultation follow-up.";
        }

        String observations = (req != null && req.observations() != null && !req.observations().isBlank())
                ? req.observations()
                : "Patient appeared alert and oriented. Symptoms evaluated over secure video consult. Visual assessment noted stable condition with no acute respiratory distress.";

        String advice = (req != null && req.doctorNotes() != null && !req.doctorNotes().isBlank())
                ? req.doctorNotes()
                : "Continue prescribed hydration and symptomatic relief. Monitor body temperature and rest. Maintain current treatment course as discussed.";

        String actions = (req != null && req.prescribedActions() != null && !req.prescribedActions().isBlank())
                ? req.prescribedActions()
                : "Adhere to the digital prescription issued in the portal. Complete any ordered blood tests or follow-up laboratory work.";

        String followUp = (req != null && req.followUp() != null && !req.followUp().isBlank())
                ? req.followUp()
                : "Schedule follow-up review in 7–10 days if symptoms persist. Seek immediate emergency care if chest tightness, severe fever, or shortness of breath develops.";

        String transcript = (req != null && req.transcript() != null) ? req.transcript() : "";

        session.setStatus(ConsultationSessionStatus.COMPLETED);
        session.setEndedAt(OffsetDateTime.now());
        session.setTranscript(transcript);
        session.setSummaryChiefComplaint(chiefComplaint);
        session.setSummaryObservations(observations);
        session.setSummaryDoctorAdvice(advice);
        session.setSummaryPrescribedActions(actions);
        session.setSummaryFollowUp(followUp);

        session = sessionRepository.save(session);

        // Automatically advance the appointment status to COMPLETED
        appt.setStatus(AppointmentStatus.COMPLETED);
        if (appt.getNotes() == null || appt.getNotes().isBlank()) {
            appt.setNotes("Video consultation completed. Summary generated.");
        }
        appointmentRepository.save(appt);

        // Clean up signaling queue for this appointment
        signalQueues.remove(appointmentId);

        return getOrCreateSession(appointmentId, requesterId);
    }

    public void pushSignal(UUID appointmentId, ConsultationSignalMessage message) {
        signalQueues.compute(appointmentId, (k, list) -> {
            List<ConsultationSignalMessage> q = (list == null) ? new ArrayList<>() : list;
            long cutoff = System.currentTimeMillis() - 120_000; // retain for 2 minutes
            q.removeIf(m -> m.timestamp() < cutoff);
            q.add(message);
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
                s.getCreatedAt()
        );
    }
}
