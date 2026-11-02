package com.group6.healthcare.clinic;

import com.group6.healthcare.clinic.dto.CreatePrescriptionRequest;
import com.group6.healthcare.clinic.dto.PrescriptionItemDto;
import com.group6.healthcare.clinic.dto.UpdatePrescriptionRequest;
import com.group6.healthcare.clinic.dto.VoidPrescriptionRequest;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.repository.PrescriptionItemRepository;
import com.group6.healthcare.clinic.repository.PrescriptionRepository;
import com.group6.healthcare.clinic.service.PrescriptionService;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ConflictException;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class PrescriptionLifecycleTest {

    @Autowired PrescriptionService prescriptionService;
    @Autowired PrescriptionRepository prescriptionRepository;
    @Autowired PrescriptionItemRepository itemRepository;
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
        itemRepository.deleteAll();
        prescriptionRepository.deleteAll();
        appointmentRepository.deleteAll();
        slotRepository.deleteAll();
        doctorRepository.deleteAll();
        userRepository.deleteAll();

        patient = userRepository.save(User.builder()
                .email("rxpatient@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Rx Patient")
                .role(Role.PATIENT).enabled(true).build());

        doctorUser = userRepository.save(User.builder()
                .email("rxdoc@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Rx Doc")
                .role(Role.DOCTOR).enabled(true).build());

        doctor = doctorRepository.save(Doctor.builder()
                .userId(doctorUser.getId())
                .fullName("Dr. Rx Doc")
                .specialty("General Medicine")
                .hospital("Rx Clinic")
                .rating(new BigDecimal("4.5")).build());

        DoctorSlot slot = slotRepository.save(DoctorSlot.builder()
                .doctorId(doctor.getId()).slotAt(OffsetDateTime.now().plusHours(1))
                .booked(true).build());

        appointment = appointmentRepository.save(Appointment.builder()
                .patientId(patient.getId()).doctorId(doctor.getId()).slotId(slot.getId())
                .consultationType(ConsultationType.VIDEO)
                .urgency(Urgency.ROUTINE).status(AppointmentStatus.COMPLETED)
                .chiefComplaint("mild cough").build());
    }

    private PrescriptionItemDto sampleItem() {
        return new PrescriptionItemDto(null, "Amoxicillin", "500 mg", "3x/day", "5 days",
                "after meals",
                java.util.List.of(com.group6.healthcare.clinic.entity.MealTiming.AFTER_BREAKFAST,
                                  com.group6.healthcare.clinic.entity.MealTiming.AFTER_DINNER));
    }

    @Test
    void createDraftThenEditThenSign() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), "watch for allergy", List.of(sampleItem())));
        assertThat(draft.status()).isEqualTo(PrescriptionStatus.DRAFT);
        assertThat(draft.items()).hasSize(1);

        var edited = prescriptionService.updateDraft(doctorUser.getId(), draft.id(),
                new UpdatePrescriptionRequest("updated notes", List.of(
                        sampleItem(),
                        new PrescriptionItemDto(null, "Paracetamol", "500 mg", "as needed", "3 days",
                                null, java.util.List.of(com.group6.healthcare.clinic.entity.MealTiming.AS_NEEDED)))));
        assertThat(edited.items()).hasSize(2);
        assertThat(edited.notes()).isEqualTo("updated notes");

        var signed = prescriptionService.sign(doctorUser.getId(), draft.id());
        assertThat(signed.status()).isEqualTo(PrescriptionStatus.SIGNED);
        assertThat(signed.signedAt()).isNotNull();
    }

    @Test
    void cannotEditSignedPrescription() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        prescriptionService.sign(doctorUser.getId(), draft.id());

        assertThatThrownBy(() -> prescriptionService.updateDraft(doctorUser.getId(), draft.id(),
                new UpdatePrescriptionRequest("tampered", List.of(sampleItem()))))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void cannotSignEmptyPrescription() {
        // Items are @NotEmpty on the request, so we simulate the service-level invariant by
        // nuking items directly through deleteAll on a fresh query (findAll scoped to this rx).
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        var items = itemRepository.findByPrescriptionIdOrderByPositionAsc(draft.id());
        itemRepository.deleteAll(items);
        assertThatThrownBy(() -> prescriptionService.sign(doctorUser.getId(), draft.id()))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void cannotCreateSecondDraftWhileActiveExists() {
        prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        assertThatThrownBy(() -> prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem()))))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void voidSignedCreatesNewVoidedRecordWithoutMutatingOriginal() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        var signed = prescriptionService.sign(doctorUser.getId(), draft.id());

        var voidRecord = prescriptionService.voidSigned(doctorUser.getId(), signed.id(),
                new VoidPrescriptionRequest("drug allergy discovered"));
        assertThat(voidRecord.status()).isEqualTo(PrescriptionStatus.VOIDED);
        assertThat(voidRecord.voidOf()).isEqualTo(signed.id());
        assertThat(voidRecord.id()).isNotEqualTo(signed.id());

        var originalReload = prescriptionRepository.findById(signed.id()).orElseThrow();
        assertThat(originalReload.getStatus()).isEqualTo(PrescriptionStatus.SIGNED);
    }

    @Test
    void cannotVoidDraft() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        assertThatThrownBy(() -> prescriptionService.voidSigned(doctorUser.getId(), draft.id(),
                new VoidPrescriptionRequest("mistake")))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void patientListsOnlyNonDraft() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        // While it's a draft, patient should see nothing.
        assertThat(prescriptionService.listForPatient(patient.getId())).isEmpty();
        prescriptionService.sign(doctorUser.getId(), draft.id());
        assertThat(prescriptionService.listForPatient(patient.getId())).hasSize(1);
    }

    @Test
    void otherDoctorCannotEditThisPrescription() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));

        User otherUser = userRepository.save(User.builder()
                .email("otherdoc@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Other Doc")
                .role(Role.DOCTOR).enabled(true).build());
        doctorRepository.save(Doctor.builder()
                .userId(otherUser.getId()).fullName("Dr. Other")
                .specialty("Dermatology").hospital("Elsewhere")
                .rating(new BigDecimal("4.0")).build());

        assertThatThrownBy(() -> prescriptionService.sign(otherUser.getId(), draft.id()))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void patientCannotReadAnotherPatientsPrescription() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        var signed = prescriptionService.sign(doctorUser.getId(), draft.id());

        User other = userRepository.save(User.builder()
                .email("otherpat@test.local")
                .passwordHash(passwordEncoder.encode("Secret12345"))
                .fullName("Other Pat")
                .role(Role.PATIENT).enabled(true).build());

        assertThatThrownBy(() -> prescriptionService.get(signed.id(), other.getId(), null))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void deleteDraftRemovesIt() {
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        prescriptionService.delete(doctorUser.getId(), draft.id());
        assertThat(prescriptionRepository.findById(draft.id())).isEmpty();
    }

    @Test
    void voidedThenCanCreateFreshDraft() {
        // Real-world void-then-reissue: doctor signs → spots a mistake → voids → writes the corrected rx.
        var draft = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        var signed = prescriptionService.sign(doctorUser.getId(), draft.id());
        prescriptionService.voidSigned(doctorUser.getId(), signed.id(),
                new VoidPrescriptionRequest("wrong drug"));

        // A new draft is allowed because the SIGNED was retired by the VOIDED record above.
        var reissued = prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), "corrected dosage",
                        List.of(new PrescriptionItemDto(null, "Azithromycin", "250 mg", "1x/day", "3 days",
                                null, java.util.List.of(com.group6.healthcare.clinic.entity.MealTiming.AFTER_DINNER)))));
        assertThat(reissued.status()).isEqualTo(PrescriptionStatus.DRAFT);
        assertThat(reissued.id()).isNotEqualTo(signed.id());

        // But a *second* DRAFT in parallel is still blocked.
        assertThatThrownBy(() -> prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem()))))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void cannotCreateDraftWhileAnotherDraftExists() {
        prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem())));
        assertThatThrownBy(() -> prescriptionService.createDraft(doctorUser.getId(),
                new CreatePrescriptionRequest(appointment.getId(), null, List.of(sampleItem()))))
                .isInstanceOf(ConflictException.class);
    }
}
