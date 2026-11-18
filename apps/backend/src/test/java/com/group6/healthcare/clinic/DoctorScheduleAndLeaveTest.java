package com.group6.healthcare.clinic;

import com.group6.healthcare.clinic.dto.CreateDoctorLeaveRequest;
import com.group6.healthcare.clinic.dto.DoctorLeaveResponse;
import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.ReplaceScheduleRequest;
import com.group6.healthcare.clinic.dto.ScheduleTemplateDto;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.DoctorLeaveRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.service.DoctorProfileService;
import com.group6.healthcare.clinic.service.SlotGeneratorService;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class DoctorScheduleAndLeaveTest {

    @Autowired DoctorProfileService doctorProfileService;
    @Autowired SlotGeneratorService slotGeneratorService;
    @Autowired DoctorRepository doctorRepository;
    @Autowired DoctorSlotRepository slotRepository;
    @Autowired DoctorLeaveRepository leaveRepository;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private User doctorUser;
    private Doctor doctor;

    @BeforeEach
    void setUp() {
        String email = "dr.schedule." + UUID.randomUUID() + "@pulsecare.test";
        doctorUser = userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode("Secret123!"))
                .fullName("Dr. Schedule Specialist")
                .role(Role.DOCTOR)
                .build());

        doctor = doctorRepository.save(Doctor.builder()
                .userId(doctorUser.getId())
                .fullName("Dr. Schedule Specialist")
                .specialty("Cardiology")
                .hospital("PulseCare General Hospital")
                .status(DoctorStatus.APPROVED)
                .consultationFee(BigDecimal.valueOf(500))
                .build());
    }

    @Test
    @Transactional
    void testWeeklyScheduleAndAutomaticSlotGenerationFor14Days() {
        // 1. Doctor defines default weekly working hours: Monday (1) & Wednesday (3), 09:00 to 11:00, 30-min slots
        List<ScheduleTemplateDto> templates = List.of(
                new ScheduleTemplateDto(null, 1, LocalTime.of(9, 0), LocalTime.of(11, 0), 30),
                new ScheduleTemplateDto(null, 3, LocalTime.of(14, 0), LocalTime.of(16, 0), 30)
        );

        DoctorMeResponse me = doctorProfileService.replaceSchedule(doctorUser.getId(), new ReplaceScheduleRequest(templates));
        assertThat(me.scheduleTemplate()).hasSize(2);

        // 2. Slots are automatically generated for the next 14 days
        List<DoctorSlot> openSlots = slotRepository.findOpenSlots(doctor.getId(), OffsetDateTime.now());
        assertThat(openSlots).isNotEmpty();

        LocalDate horizonLimit = LocalDate.now().plusDays(14);
        for (DoctorSlot slot : openSlots) {
            LocalDate slotDate = slot.getSlotAt().toLocalDate();
            assertThat(slotDate).isBeforeOrEqualTo(horizonLimit);
            int dow = slotDate.getDayOfWeek().getValue();
            assertThat(dow).isIn(1, 3); // Only Mon or Wed
        }
    }

    @Test
    @Transactional
    void testMarkingLeaveDateSuppressesSlotsAndRemovesUnbookedSlots() {
        // Configure Monday template
        List<ScheduleTemplateDto> templates = List.of(
                new ScheduleTemplateDto(null, 1, LocalTime.of(9, 0), LocalTime.of(11, 0), 30)
        );
        doctorProfileService.replaceSchedule(doctorUser.getId(), new ReplaceScheduleRequest(templates));

        // Find the next Monday
        LocalDate nextMonday = LocalDate.now();
        while (nextMonday.getDayOfWeek().getValue() != 1) {
            nextMonday = nextMonday.plusDays(1);
        }

        // Verify slots existed on next Monday before leave
        final LocalDate targetMonday = nextMonday;
        List<DoctorSlot> slotsBeforeLeave = slotRepository.findOpenSlots(doctor.getId(), OffsetDateTime.now())
                .stream()
                .filter(s -> s.getSlotAt().toLocalDate().equals(targetMonday))
                .toList();
        assertThat(slotsBeforeLeave).isNotEmpty();

        // 3. Mark leave dates: next Monday
        CreateDoctorLeaveRequest leaveReq = new CreateDoctorLeaveRequest(
                targetMonday, targetMonday, "Attending Medical Cardiology Conference"
        );
        DoctorLeaveResponse leaveResp = doctorProfileService.createLeave(doctorUser.getId(), leaveReq);
        assertThat(leaveResp.id()).isNotNull();
        assertThat(leaveResp.reason()).isEqualTo("Attending Medical Cardiology Conference");

        // Verify unbooked slots on next Monday are immediately deleted and suppressed
        List<DoctorSlot> slotsDuringLeave = slotRepository.findOpenSlots(doctor.getId(), OffsetDateTime.now())
                .stream()
                .filter(s -> s.getSlotAt().toLocalDate().equals(targetMonday))
                .toList();
        assertThat(slotsDuringLeave).isEmpty();

        // 4. Deleting the leave restores slots on next Monday
        doctorProfileService.deleteLeave(doctorUser.getId(), leaveResp.id());
        List<DoctorSlot> slotsAfterLeaveRestored = slotRepository.findOpenSlots(doctor.getId(), OffsetDateTime.now())
                .stream()
                .filter(s -> s.getSlotAt().toLocalDate().equals(targetMonday))
                .toList();
        assertThat(slotsAfterLeaveRestored).isNotEmpty();
    }
}
