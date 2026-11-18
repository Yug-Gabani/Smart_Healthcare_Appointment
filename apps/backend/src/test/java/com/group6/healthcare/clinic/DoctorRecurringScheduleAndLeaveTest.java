package com.group6.healthcare.clinic;

import com.group6.healthcare.clinic.dto.CreateDoctorLeaveRequest;
import com.group6.healthcare.clinic.dto.DoctorLeaveDto;
import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.DoctorSlotDetailResponse;
import com.group6.healthcare.clinic.dto.ReplaceScheduleRequest;
import com.group6.healthcare.clinic.dto.ScheduleTemplateDto;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorLeaveRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorScheduleTemplateRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.service.DoctorProfileService;
import com.group6.healthcare.clinic.service.SlotGeneratorService;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class DoctorRecurringScheduleAndLeaveTest {

    @Autowired DoctorProfileService doctorProfileService;
    @Autowired SlotGeneratorService slotGeneratorService;
    @Autowired DoctorRepository doctorRepository;
    @Autowired DoctorSlotRepository slotRepository;
    @Autowired DoctorScheduleTemplateRepository templateRepository;
    @Autowired DoctorLeaveRepository leaveRepository;
    @Autowired AppointmentRepository appointmentRepository;
    @Autowired UserRepository userRepository;

    private User doctorUser;
    private Doctor doctor;

    @BeforeEach
    void setup() {
        appointmentRepository.deleteAll();
        leaveRepository.deleteAll();
        slotRepository.deleteAll();
        templateRepository.deleteAll();
        doctorRepository.deleteAll();
        userRepository.deleteAll();

        doctorUser = userRepository.save(User.builder()
                .email("doctor.recurring@example.com")
                .passwordHash("hashed")
                .fullName("Dr. Sarah Jenkins")
                .role(Role.DOCTOR)
                .enabled(true)
                .build());

        doctor = doctorRepository.save(Doctor.builder()
                .userId(doctorUser.getId())
                .fullName("Dr. Sarah Jenkins")
                .specialty("Cardiology")
                .hospital("City General")
                .rating(BigDecimal.valueOf(4.9))
                .status(DoctorStatus.APPROVED)
                .build());
    }

    @Test
    void testDefineWeeklyRecurringWorkingHoursGenerates14DaysOfSlots() {
        // Acceptance criteria: Doctor can define default weekly working hours (e.g. Mon/Wed/Fri from 9:00 AM to 1:00 PM with 20 minute slots)
        // Acceptance criteria: Slots are automatically generated for the next 14 days.
        List<ScheduleTemplateDto> templates = List.of(
                new ScheduleTemplateDto(null, DayOfWeek.MONDAY.getValue(), LocalTime.of(9, 0), LocalTime.of(13, 0), 20),
                new ScheduleTemplateDto(null, DayOfWeek.WEDNESDAY.getValue(), LocalTime.of(9, 0), LocalTime.of(13, 0), 20),
                new ScheduleTemplateDto(null, DayOfWeek.FRIDAY.getValue(), LocalTime.of(9, 0), LocalTime.of(13, 0), 20)
        );

        DoctorMeResponse resp = doctorProfileService.replaceSchedule(doctorUser.getId(), new ReplaceScheduleRequest(templates));
        assertThat(resp.scheduleTemplate()).hasSize(3);

        List<DoctorSlotDetailResponse> mySlots = doctorProfileService.getMySlots(doctorUser.getId(), 14);
        assertThat(mySlots).isNotEmpty();

        // Verify all generated slots fall on Mon, Wed, or Fri between 09:00 and 13:00
        for (DoctorSlotDetailResponse slot : mySlots) {
            DayOfWeek dow = slot.slotAt().getDayOfWeek();
            assertThat(dow).isIn(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY);
            LocalTime time = slot.slotAt().toLocalTime();
            assertThat(time).isBefore(LocalTime.of(13, 0));
            assertThat(time.isBefore(LocalTime.of(9, 0))).isFalse();
            assertThat(slot.available()).isTrue();
            assertThat(slot.booked()).isFalse();
        }
    }

    @Test
    void testMarkLeaveSuppressesSlotCreationAndMarksExistingUnbookedSlotsUnavailable() {
        // Acceptance criteria: Marking leave dates automatically suppresses slot creation and marks existing unbooked slots as unavailable.
        List<ScheduleTemplateDto> templates = List.of(
                new ScheduleTemplateDto(null, 1, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 2, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 3, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 4, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 5, LocalTime.of(9, 0), LocalTime.of(17, 0), 30)
        );
        doctorProfileService.replaceSchedule(doctorUser.getId(), new ReplaceScheduleRequest(templates));

        // Mark leave for tomorrow and the day after
        LocalDate leaveStart = LocalDate.now().plusDays(1);
        LocalDate leaveEnd = LocalDate.now().plusDays(2);
        DoctorLeaveDto leaveDto = doctorProfileService.addLeave(
                doctorUser.getId(),
                new CreateDoctorLeaveRequest(leaveStart, leaveEnd, "Annual Medical Conference")
        );
        assertThat(leaveDto.id()).isNotNull();
        assertThat(leaveDto.reason()).isEqualTo("Annual Medical Conference");

        // Existing unbooked slots on leave days must now be marked UNAVAILABLE
        List<DoctorSlotDetailResponse> slotsAfterLeave = doctorProfileService.getMySlots(doctorUser.getId(), 14);
        for (DoctorSlotDetailResponse s : slotsAfterLeave) {
            LocalDate d = s.slotAt().toLocalDate();
            if (!d.isBefore(leaveStart) && !d.isAfter(leaveEnd)) {
                assertThat(s.available())
                        .as("Slot on leave date %s must be marked unavailable", d)
                        .isFalse();
                assertThat(s.onLeave()).isTrue();
                assertThat(s.leaveReason()).isEqualTo("Annual Medical Conference");
            }
        }

        // Test slot regeneration: regenerating must SUPPRESS slots on marked leave dates
        slotGeneratorService.regenerate(doctor.getId(), 14);
        List<DoctorSlot> remainingSlots = slotRepository.findOpenSlots(doctor.getId(), OffsetDateTime.now());
        for (DoctorSlot openSlot : remainingSlots) {
            LocalDate d = openSlot.getSlotAt().toLocalDate();
            assertThat(!d.isBefore(leaveStart) && !d.isAfter(leaveEnd))
                    .as("No open slots should be generated on leave dates %s to %s", leaveStart, leaveEnd)
                    .isFalse();
        }
    }

    @Test
    void testDeleteLeaveRestoresRegularSchedule() {
        // Define weekly schedule
        List<ScheduleTemplateDto> templates = List.of(
                new ScheduleTemplateDto(null, 1, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 2, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 3, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 4, LocalTime.of(9, 0), LocalTime.of(17, 0), 30),
                new ScheduleTemplateDto(null, 5, LocalTime.of(9, 0), LocalTime.of(17, 0), 30)
        );
        doctorProfileService.replaceSchedule(doctorUser.getId(), new ReplaceScheduleRequest(templates));

        LocalDate leaveDate = LocalDate.now().plusDays(3);
        DoctorLeaveDto leave = doctorProfileService.addLeave(
                doctorUser.getId(),
                new CreateDoctorLeaveRequest(leaveDate, leaveDate, "Family Function")
        );

        // Delete leave
        doctorProfileService.deleteLeave(doctorUser.getId(), leave.id());

        // Verify leave record is deleted
        assertThat(doctorProfileService.getLeaves(doctorUser.getId())).isEmpty();

        // Verify schedule for leaveDate was restored if it's a weekday
        if (leaveDate.getDayOfWeek().getValue() <= 5) {
            List<DoctorSlot> openSlots = slotRepository.findOpenSlots(doctor.getId(), OffsetDateTime.now());
            boolean hasSlotOnLeaveDate = openSlots.stream().anyMatch(s -> s.getSlotAt().toLocalDate().equals(leaveDate));
            assertThat(hasSlotOnLeaveDate).isTrue();
        }
    }

    @Test
    void testAddAdHocSlotOnLeaveDateIsRejected() {
        LocalDate leaveDate = LocalDate.now().plusDays(2);
        doctorProfileService.addLeave(
                doctorUser.getId(),
                new CreateDoctorLeaveRequest(leaveDate, leaveDate, "Personal Leave")
        );

        OffsetDateTime slotTime = leaveDate.atTime(10, 0).atOffset(OffsetDateTime.now().getOffset());
        assertThatThrownBy(() -> doctorProfileService.addAdHocSlot(doctorUser.getId(), slotTime))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Cannot add slot on a marked leave date");
    }
}
