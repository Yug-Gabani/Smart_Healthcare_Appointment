package com.group6.healthcare.clinic;

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
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.ConsultationSessionRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.service.ConsultationService;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class ConsultationServiceTest {

    @Autowired ConsultationService consultationService;
    @Autowired ConsultationSessionRepository sessionRepository;
    @Autowired AppointmentRepository appointmentRepository;
    @Autowired DoctorRepository doctorRepository;
    @Autowired DoctorSlotRepository slotRepository;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private User patient;
    private User doctorUser;
    private Doctor doctor;
    private DoctorSlot slot;
    private Appointment videoAppointment;

    @BeforeEach
    void setUp() {
        sessionRepository.deleteAll();
        appointmentRepository.deleteAll();
        slotRepository.deleteAll();
        doctorRepository.deleteAll();
        userRepository.deleteAll();

        patient = userRepository.save(User.builder()
                .email("telepatient@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Tele Patient")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        doctorUser = userRepository.save(User.builder()
                .email("teledoctor@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Dr. Tele Clinician")
                .role(Role.DOCTOR)
                .enabled(true)
                .build());

        doctor = doctorRepository.save(Doctor.builder()
                .userId(doctorUser.getId())
                .fullName("Dr. Tele Clinician")
                .specialty("General Medicine")
                .hospital("PulseCare Virtual Clinic")
                .rating(new BigDecimal("4.9"))
                .build());

        slot = slotRepository.save(DoctorSlot.builder()
                .doctorId(doctor.getId())
                .slotAt(OffsetDateTime.now().plusMinutes(10))
                .booked(true)
                .build());

        videoAppointment = appointmentRepository.save(Appointment.builder()
                .patientId(patient.getId())
                .doctorId(doctor.getId())
                .slotId(slot.getId())
                .consultationType(ConsultationType.VIDEO)
                .urgency(Urgency.ROUTINE)
                .status(AppointmentStatus.CONFIRMED)
                .chiefComplaint("Migraine and visual auras")
                .build());
    }

    @Test
    @DisplayName("Authorized patient or doctor can get or initialize a video consultation room")
    void testGetOrCreateSessionAuthorized() {
        ConsultationSessionResponse response = consultationService.getOrCreateSession(
                videoAppointment.getId(),
                patient.getId()
        );

        assertThat(response).isNotNull();
        assertThat(response.appointmentId()).isEqualTo(videoAppointment.getId());
        assertThat(response.roomId()).isNotBlank();
        assertThat(response.status()).isEqualTo(ConsultationSessionStatus.SCHEDULED);
        assertThat(response.patientName()).isEqualTo("Tele Patient");
        assertThat(response.doctorName()).contains("Dr. Tele Clinician");
    }

    @Test
    @DisplayName("Unauthorized third-party user cannot access consultation session")
    void testUnauthorizedAccessRejected() {
        UUID strangerId = UUID.randomUUID();

        assertThatThrownBy(() -> consultationService.getOrCreateSession(videoAppointment.getId(), strangerId))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("not an authorized participant");
    }

    @Test
    @DisplayName("In-person appointment rejects video consultation initialization")
    void testInPersonAppointmentRejected() {
        Appointment clinicAppt = appointmentRepository.save(Appointment.builder()
                .patientId(patient.getId())
                .doctorId(doctor.getId())
                .slotId(slot.getId())
                .consultationType(ConsultationType.IN_PERSON)
                .urgency(Urgency.ROUTINE)
                .status(AppointmentStatus.CONFIRMED)
                .chiefComplaint("Physical checkup")
                .build());

        assertThatThrownBy(() -> consultationService.getOrCreateSession(clinicAppt.getId(), patient.getId()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("in-person clinic visit");
    }

    @Test
    @DisplayName("Clinician or patient can push and poll WebRTC signaling messages")
    void testWebRtcSignalingMessageBus() {
        // Patient sends WebRTC SDP Offer
        ConsultationSignalMessage offerMsg = new ConsultationSignalMessage(
                "OFFER",
                patient.getId(),
                "PATIENT",
                "{\"type\":\"offer\",\"sdp\":\"v=0...\"}",
                System.currentTimeMillis()
        );
        consultationService.pushSignal(videoAppointment.getId(), offerMsg);

        // Doctor polls for signals from patient
        List<ConsultationSignalMessage> doctorSignals = consultationService.pollSignals(
                videoAppointment.getId(),
                doctorUser.getId(),
                0L
        );

        assertThat(doctorSignals).isNotEmpty();
        assertThat(doctorSignals.get(0).type()).isEqualTo("OFFER");
        assertThat(doctorSignals.get(0).senderId()).isEqualTo(patient.getId());

        // Patient polling must not receive their own message back
        List<ConsultationSignalMessage> patientSignals = consultationService.pollSignals(
                videoAppointment.getId(),
                patient.getId(),
                0L
        );
        assertThat(patientSignals).isEmpty();
    }

    @Test
    @DisplayName("Ending consultation generates structured clinical summary and completes appointment")
    void testEndConsultationAndSummaryGeneration() {
        consultationService.startConsultation(videoAppointment.getId(), doctorUser.getId());

        ConsultationEndRequest endReq = new ConsultationEndRequest(
                "Live video dialogue: patient reports recurrent headaches.",
                "Prescribed analgesics, rest in dark room, hydration.",
                "Patient alert, BP 120/80, normal neurological responses.",
                "Review digital prescription; maintain symptom log.",
                "Follow up in 10 days if headaches persist."
        );

        ConsultationSessionResponse finished = consultationService.endConsultation(
                videoAppointment.getId(),
                doctorUser.getId(),
                endReq
        );

        assertThat(finished.status()).isEqualTo(ConsultationSessionStatus.COMPLETED);
        assertThat(finished.summaryChiefComplaint()).isEqualTo("Migraine and visual auras");
        assertThat(finished.summaryObservations()).contains("BP 120/80");
        assertThat(finished.summaryDoctorAdvice()).contains("Prescribed analgesics");

        // Verify appointment status was marked COMPLETED in database
        Appointment updatedAppt = appointmentRepository.findById(videoAppointment.getId()).orElseThrow();
        assertThat(updatedAppt.getStatus()).isEqualTo(AppointmentStatus.COMPLETED);
    }
}
