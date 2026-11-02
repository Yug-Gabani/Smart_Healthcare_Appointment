package com.group6.healthcare.clinic;

import com.group6.healthcare.clinic.dto.BookAppointmentRequest;
import com.group6.healthcare.clinic.dto.PatchAppointmentRequest;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.service.AppointmentService;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration-style tests for doctor-side appointment actions. Each test seeds a doctor,
 * a patient, a slot and a booking, then exercises AppointmentService.doctorAction directly.
 */
@SpringBootTest
@ActiveProfiles("test")
class AppointmentActionTest {

    @Autowired AppointmentService appointmentService;
    @Autowired DoctorRepository doctorRepository;
    @Autowired DoctorSlotRepository slotRepository;
    @Autowired AppointmentRepository appointmentRepository;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private User patient;
    private User doctorUser;
    private Doctor doctor;
    private Appointment appointment;

    @BeforeEach
    void seed() {
        appointmentRepository.deleteAll();
        slotRepository.deleteAll();
        doctorRepository.deleteAll();
        userRepository.deleteAll();

        patient = userRepository.save(User.builder()
                .email("p1@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Pat One")
                .role(Role.PATIENT)
                .enabled(true).build());

        doctorUser = userRepository.save(User.builder()
                .email("doc1@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Doc One")
                .role(Role.DOCTOR)
                .enabled(true).build());

        doctor = doctorRepository.save(Doctor.builder()
                .userId(doctorUser.getId())
                .fullName("Dr. One")
                .specialty("Cardiology")
                .hospital("Test Clinic")
                .rating(new BigDecimal("4.5"))
                .build());

        DoctorSlot slot = slotRepository.save(DoctorSlot.builder()
                .doctorId(doctor.getId())
                .slotAt(OffsetDateTime.now().plusHours(2))
                .booked(false)
                .build());

        appointment = Appointment.builder()
                .patientId(patient.getId())
                .doctorId(doctor.getId())
                .slotId(slot.getId())
                .consultationType(ConsultationType.VIDEO)
                .urgency(Urgency.ROUTINE)
                .status(AppointmentStatus.BOOKED)
                .chiefComplaint("Mild cough")
                .build();
        appointment = appointmentRepository.save(appointment);
        slot.setBooked(true);
        slotRepository.save(slot);
    }

    @Test
    void acceptMovesBookedToConfirmed() {
        var resp = appointmentService.doctorAction(
                doctorUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.ACCEPT, null, null, null));
        assertThat(resp.status()).isEqualTo(AppointmentStatus.CONFIRMED);
    }

    @Test
    void completeFromBookedWorks() {
        var resp = appointmentService.doctorAction(
                doctorUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.COMPLETE, null, null, "Patient advised rest."));
        assertThat(resp.status()).isEqualTo(AppointmentStatus.COMPLETED);
        assertThat(resp.notes()).contains("Patient advised rest.");
    }

    @Test
    void overrideUrgencyRequiresReason() {
        assertThatThrownBy(() -> appointmentService.doctorAction(
                doctorUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.OVERRIDE_URGENCY,
                        Urgency.EMERGENCY, "", null)))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void overrideUrgencyStampsReasonInNotes() {
        var resp = appointmentService.doctorAction(
                doctorUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.OVERRIDE_URGENCY,
                        Urgency.EMERGENCY, "Patient reporting chest pain over the phone", null));
        assertThat(resp.urgency()).isEqualTo(Urgency.EMERGENCY);
        assertThat(resp.notes()).contains("OVERRIDE ROUTINE→EMERGENCY");
        assertThat(resp.notes()).contains("chest pain");
    }

    @Test
    void acceptFailsIfAlreadyCompleted() {
        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointmentRepository.save(appointment);
        assertThatThrownBy(() -> appointmentService.doctorAction(
                doctorUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.ACCEPT, null, null, null)))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void otherDoctorCannotActOnThisAppointment() {
        User otherUser = userRepository.save(User.builder()
                .email("other@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Other Doc")
                .role(Role.DOCTOR)
                .enabled(true).build());
        Doctor other = doctorRepository.save(Doctor.builder()
                .userId(otherUser.getId())
                .fullName("Dr. Other")
                .specialty("Dermatology")
                .hospital("Elsewhere")
                .rating(new BigDecimal("4.0"))
                .build());
        // Act as "other" user against the first doctor's appointment
        assertThatThrownBy(() -> appointmentService.doctorAction(
                otherUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.ACCEPT, null, null, null)))
                .isInstanceOf(BusinessRuleException.class);
        // Ensure the "other" doctor row is actually there (silences unused warning)
        assertThat(other.getId()).isNotNull();
    }

    @Test
    void doctorWithoutLinkedProfileFails() {
        // Create a DOCTOR user with no Doctor row linked.
        User lonely = userRepository.save(User.builder()
                .email("lonely@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Lonely Doc")
                .role(Role.DOCTOR)
                .enabled(true).build());
        assertThatThrownBy(() -> appointmentService.doctorAction(
                lonely.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.ACCEPT, null, null, null)))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void noShowTransitionsFromBooked() {
        var resp = appointmentService.doctorAction(
                doctorUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.NO_SHOW, null, null, null));
        assertThat(resp.status()).isEqualTo(AppointmentStatus.NO_SHOW);
    }

    @Test
    void overrideKeepsStatusUntouched() {
        var resp = appointmentService.doctorAction(
                doctorUser.getId(),
                appointment.getId(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.OVERRIDE_URGENCY,
                        Urgency.URGENT, "Severity escalated by phone call", null));
        assertThat(resp.status()).isEqualTo(AppointmentStatus.BOOKED);
        assertThat(resp.urgency()).isEqualTo(Urgency.URGENT);
    }

    @Test
    void nonExistentAppointmentIs404() {
        assertThatThrownBy(() -> appointmentService.doctorAction(
                doctorUser.getId(),
                UUID.randomUUID(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.ACCEPT, null, null, null)))
                .isInstanceOf(com.group6.healthcare.common.exception.ResourceNotFoundException.class);
    }

    @Test
    void bookAnotherAppointmentThenAcceptIt() {
        // Smoke test: book flow + action
        DoctorSlot slot2 = slotRepository.save(DoctorSlot.builder()
                .doctorId(doctor.getId())
                .slotAt(OffsetDateTime.now().plusDays(1))
                .booked(false).build());
        var booked = appointmentService.book(patient.getId(),
                new BookAppointmentRequest(doctor.getId(), slot2.getId(), null, ConsultationType.VIDEO, null));
        assertThat(booked.status()).isEqualTo(AppointmentStatus.BOOKED);
        var confirmed = appointmentService.doctorAction(
                doctorUser.getId(),
                booked.id(),
                new PatchAppointmentRequest(PatchAppointmentRequest.Action.ACCEPT, null, null, null));
        assertThat(confirmed.status()).isEqualTo(AppointmentStatus.CONFIRMED);
    }
}
