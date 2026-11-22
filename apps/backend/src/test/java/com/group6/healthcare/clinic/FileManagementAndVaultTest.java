package com.group6.healthcare.clinic;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.controller.FileController;
import com.group6.healthcare.clinic.dto.AttachmentResponse;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.repository.TriageAttachmentRepository;
import com.group6.healthcare.clinic.service.FileStorageService;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class FileManagementAndVaultTest {

    @Autowired FileController fileController;
    @Autowired FileStorageService fileStorageService;
    @Autowired TriageAttachmentRepository attachmentRepository;
    @Autowired DoctorRepository doctorRepository;
    @Autowired DoctorSlotRepository slotRepository;
    @Autowired AppointmentRepository appointmentRepository;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private User patient;
    private User otherPatient;
    private User doctorUserWithAppt;
    private Doctor doctorWithAppt;
    private User doctorUserWithoutAppt;
    private Doctor doctorWithoutAppt;

    @BeforeEach
    void setUp() {
        patient = userRepository.save(User.builder()
                .email("vault-patient-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode("secret"))
                .fullName("Vault Patient")
                .role(Role.PATIENT)
                .build());

        otherPatient = userRepository.save(User.builder()
                .email("other-patient-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode("secret"))
                .fullName("Other Patient")
                .role(Role.PATIENT)
                .build());

        doctorUserWithAppt = userRepository.save(User.builder()
                .email("doc-with-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode("secret"))
                .fullName("Dr. Attending")
                .role(Role.DOCTOR)
                .build());

        doctorWithAppt = doctorRepository.save(Doctor.builder()
                .userId(doctorUserWithAppt.getId())
                .fullName(doctorUserWithAppt.getFullName())
                .specialty("Neurology")
                .hospital("PulseCare Hospital")
                .status(DoctorStatus.APPROVED)
                .consultationFee(BigDecimal.valueOf(500))
                .rating(BigDecimal.valueOf(4.8))
                .build());

        doctorUserWithoutAppt = userRepository.save(User.builder()
                .email("doc-without-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode("secret"))
                .fullName("Dr. Unrelated")
                .role(Role.DOCTOR)
                .build());

        doctorWithoutAppt = doctorRepository.save(Doctor.builder()
                .userId(doctorUserWithoutAppt.getId())
                .fullName(doctorUserWithoutAppt.getFullName())
                .specialty("Dermatology")
                .hospital("PulseCare Hospital")
                .status(DoctorStatus.APPROVED)
                .consultationFee(BigDecimal.valueOf(400))
                .rating(BigDecimal.valueOf(4.5))
                .build());

        // Create slot and appointment for doctorWithAppt and patient
        DoctorSlot slot = slotRepository.save(DoctorSlot.builder()
                .doctorId(doctorWithAppt.getId())
                .slotAt(OffsetDateTime.now().plusDays(1))
                .booked(true)
                .build());

        appointmentRepository.save(Appointment.builder()
                .patientId(patient.getId())
                .doctorId(doctorWithAppt.getId())
                .slotId(slot.getId())
                .status(AppointmentStatus.BOOKED)
                .consultationType(ConsultationType.VIDEO)
                .urgency(Urgency.ROUTINE)
                .build());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private AppUserPrincipal setAuth(User user) {
        AppUserPrincipal principal = AppUserPrincipal.of(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );
        return principal;
    }

    @Test
    void patientCanUploadMultipleCategoriesIndependently() {
        AppUserPrincipal patientPrincipal = setAuth(patient);

        MockMultipartFile bloodReport = new MockMultipartFile(
                "file", "blood_test.pdf", "application/pdf", "dummy pdf content".getBytes()
        );
        var res1 = fileController.upload(patientPrincipal, bloodReport, "BLOOD_REPORT", null, null);
        assertThat(res1.getBody()).isNotNull();
        assertThat(res1.getBody().data().fileCategory()).isEqualTo("BLOOD_REPORT");

        MockMultipartFile mri = new MockMultipartFile(
                "file", "brain_mri.png", "image/png", "dummy png content".getBytes()
        );
        var res2 = fileController.upload(patientPrincipal, mri, "MRI", null, null);
        assertThat(res2.getBody()).isNotNull();
        assertThat(res2.getBody().data().fileCategory()).isEqualTo("MRI");

        MockMultipartFile xray = new MockMultipartFile(
                "file", "chest_xray.jpg", "image/jpeg", "dummy jpg content".getBytes()
        );
        var res3 = fileController.upload(patientPrincipal, xray, "XRAY", null, null);
        assertThat(res3.getBody()).isNotNull();
        assertThat(res3.getBody().data().fileCategory()).isEqualTo("XRAY");

        // Verify patient can retrieve all 3 files via myAttachments
        ApiResponse<List<AttachmentResponse>> myDocs = fileController.myAttachments(patientPrincipal);
        assertThat(myDocs.data()).hasSize(3);
    }

    @Test
    void patientCannotViewAnotherPatientsRecords() {
        AppUserPrincipal otherPrincipal = setAuth(otherPatient);

        assertThatThrownBy(() -> fileController.getPatientAttachments(otherPrincipal, patient.getId()))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Patients can only view their own medical records");
    }

    @Test
    void doctorWithoutAppointmentCannotViewPatientRecords() {
        AppUserPrincipal unrelatedDocPrincipal = setAuth(doctorUserWithoutAppt);

        assertThatThrownBy(() -> fileController.getPatientAttachments(unrelatedDocPrincipal, patient.getId()))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Doctor is not authorized to view records for this patient");
    }

    @Test
    void doctorWithAppointmentCanViewPatientHistoricalRecords() {
        AppUserPrincipal patientPrincipal = setAuth(patient);

        MockMultipartFile file = new MockMultipartFile(
                "file", "history_mri.pdf", "application/pdf", "dummy content".getBytes()
        );
        fileController.upload(patientPrincipal, file, "MRI", null, null);

        AppUserPrincipal attendingDocPrincipal = setAuth(doctorUserWithAppt);

        ApiResponse<List<AttachmentResponse>> patientDocs = fileController.getPatientAttachments(
                attendingDocPrincipal, patient.getId()
        );

        assertThat(patientDocs.data()).hasSize(1);
        assertThat(patientDocs.data().get(0).fileName()).isEqualTo("history_mri.pdf");
        assertThat(patientDocs.data().get(0).fileCategory()).isEqualTo("MRI");
    }

    @Test
    void patientCanDeleteTheirOwnAttachment() {
        AppUserPrincipal patientPrincipal = setAuth(patient);

        MockMultipartFile file = new MockMultipartFile(
                "file", "to_delete.pdf", "application/pdf", "dummy content".getBytes()
        );
        var uploadRes = fileController.upload(patientPrincipal, file, "PRESCRIPTION", null, null);
        UUID attachmentId = uploadRes.getBody().data().id();

        // Delete attachment
        ApiResponse<Void> deleteRes = fileController.deleteAttachment(patientPrincipal, attachmentId);
        assertThat(deleteRes.message()).isEqualTo("Attachment deleted successfully");

        // Verify it is gone
        ApiResponse<List<AttachmentResponse>> myDocs = fileController.myAttachments(patientPrincipal);
        assertThat(myDocs.data()).isEmpty();
    }
}
