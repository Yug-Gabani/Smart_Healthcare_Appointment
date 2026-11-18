package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.CreateDoctorLeaveRequest;
import com.group6.healthcare.clinic.dto.DoctorLeaveDto;
import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.DoctorSlotDetailResponse;
import com.group6.healthcare.clinic.dto.ReplaceScheduleRequest;
import com.group6.healthcare.clinic.dto.ScheduleTemplateDto;
import com.group6.healthcare.clinic.dto.UpdateDoctorProfileRequest;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorLeave;
import com.group6.healthcare.clinic.entity.DoctorScheduleTemplate;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorLeaveRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorScheduleTemplateRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DoctorProfileService {

    private final DoctorRepository doctorRepository;
    private final DoctorScheduleTemplateRepository templateRepository;
    private final DoctorSlotRepository slotRepository;
    private final SlotGeneratorService slotGenerator;
    private final DoctorLeaveRepository leaveRepository;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;

    public DoctorProfileService(DoctorRepository doctorRepository,
                                DoctorScheduleTemplateRepository templateRepository,
                                DoctorSlotRepository slotRepository,
                                SlotGeneratorService slotGenerator,
                                DoctorLeaveRepository leaveRepository,
                                AppointmentRepository appointmentRepository,
                                UserRepository userRepository) {
        this.doctorRepository = doctorRepository;
        this.templateRepository = templateRepository;
        this.slotRepository = slotRepository;
        this.slotGenerator = slotGenerator;
        this.leaveRepository = leaveRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public DoctorMeResponse getMyProfile(UUID userId) {
        Doctor d = findByUserId(userId);
        List<ScheduleTemplateDto> templates = templateRepository
                .findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(d.getId())
                .stream()
                .map(t -> new ScheduleTemplateDto(
                        t.getId(), t.getDayOfWeek(), t.getStartTime(), t.getEndTime(),
                        t.getSlotDurationMinutes()))
                .toList();

        List<DoctorLeaveDto> leaves = leaveRepository
                .findByDoctorIdOrderByStartDateAsc(d.getId())
                .stream()
                .map(this::toLeaveDto)
                .toList();

        return toResponse(d, templates, leaves);
    }

    @Transactional
    public DoctorMeResponse updateMyProfile(UUID userId, UpdateDoctorProfileRequest req) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() == DoctorStatus.PENDING) {
            throw new BusinessRuleException("Profile is locked while pending admin review");
        }
        if (req.fullName() != null && !req.fullName().isBlank()) d.setFullName(req.fullName().trim());
        if (req.specialty() != null && !req.specialty().isBlank()) d.setSpecialty(req.specialty().trim());
        if (req.hospitalName() != null) d.setHospital(req.hospitalName().trim());
        if (req.hospitalId() != null) d.setHospitalId(req.hospitalId());
        if (req.registrationNumber() != null && !req.registrationNumber().isBlank()) {
            d.setRegistrationNumber(req.registrationNumber().trim());
        }
        if (req.yearsExperience() != null) d.setYearsExperience(req.yearsExperience());
        if (req.consultationFee() != null) d.setConsultationFee(req.consultationFee());
        if (req.languages() != null) d.setLanguages(req.languages().trim());
        if (req.bio() != null) d.setBio(req.bio().trim());
        if (req.avatarUrl() != null) d.setAvatarUrl(req.avatarUrl().trim());
        doctorRepository.save(d);
        return getMyProfile(userId);
    }

    @Transactional
    public DoctorMeResponse resubmitForReview(UUID userId) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() != DoctorStatus.REJECTED) {
            throw new BusinessRuleException("Only rejected profiles can be re-submitted");
        }
        d.setStatus(DoctorStatus.PENDING);
        d.setRejectionReason(null);
        d.setSubmittedAt(OffsetDateTime.now());
        d.setReviewedAt(null);
        d.setReviewedBy(null);
        doctorRepository.save(d);
        return getMyProfile(userId);
    }

    @Transactional
    public DoctorMeResponse replaceSchedule(UUID userId, ReplaceScheduleRequest req) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() == DoctorStatus.PENDING) {
            throw new BusinessRuleException("Schedule is locked while pending admin review");
        }
        for (ScheduleTemplateDto dto : req.templates()) {
            if (!dto.endTime().isAfter(dto.startTime())) {
                throw new BusinessRuleException("End time must be after start time");
            }
        }
        templateRepository.deleteByDoctorId(d.getId());
        for (ScheduleTemplateDto dto : req.templates()) {
            templateRepository.save(DoctorScheduleTemplate.builder()
                    .doctorId(d.getId())
                    .dayOfWeek(dto.dayOfWeek())
                    .startTime(dto.startTime())
                    .endTime(dto.endTime())
                    .slotDurationMinutes(dto.slotDurationMinutes())
                    .build());
        }
        slotGenerator.regenerate(d.getId(), 14);
        return getMyProfile(userId);
    }

    // ---------- Vacation & Leave Calendar ----------

    @Transactional(readOnly = true)
    public List<DoctorLeaveDto> getLeaves(UUID userId) {
        Doctor d = findByUserId(userId);
        return leaveRepository.findByDoctorIdOrderByStartDateAsc(d.getId())
                .stream()
                .map(this::toLeaveDto)
                .toList();
    }

    @Transactional
    public DoctorLeaveDto addLeave(UUID userId, CreateDoctorLeaveRequest req) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() == DoctorStatus.PENDING) {
            throw new BusinessRuleException("Leaves are locked while pending admin review");
        }
        if (req.startDate() == null || req.endDate() == null) {
            throw new BusinessRuleException("Start date and end date are required");
        }
        if (req.endDate().isBefore(req.startDate())) {
            throw new BusinessRuleException("End date cannot be before start date");
        }

        DoctorLeave leave = leaveRepository.save(DoctorLeave.builder()
                .doctorId(d.getId())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .reason(req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : null)
                .build());

        // Acceptance Criteria: Marking leave dates automatically suppresses slot creation
        // and marks existing unbooked slots as unavailable.
        ZoneOffset offset = OffsetDateTime.now().getOffset();
        OffsetDateTime from = req.startDate().atStartOfDay().atOffset(offset).minusDays(1);
        OffsetDateTime to = req.endDate().plusDays(2).atStartOfDay().atOffset(offset);

        List<DoctorSlot> slotsInRange = slotRepository.findSlotsInRange(d.getId(), from, to);
        for (DoctorSlot s : slotsInRange) {
            LocalDate slotDate = s.getSlotAt().toLocalDate();
            if (!s.isBooked() && !slotDate.isBefore(req.startDate()) && !slotDate.isAfter(req.endDate())) {
                s.setAvailable(false);
                slotRepository.save(s);
            }
        }

        return toLeaveDto(leave);
    }

    @Transactional
    public void deleteLeave(UUID userId, UUID leaveId) {
        Doctor d = findByUserId(userId);
        DoctorLeave leave = leaveRepository.findById(leaveId)
                .orElseThrow(() -> new ResourceNotFoundException("DoctorLeave", leaveId));
        if (!leave.getDoctorId().equals(d.getId())) {
            throw new BusinessRuleException("Cannot delete another doctor's leave");
        }
        leaveRepository.delete(leave);

        // Regenerate future 14-day schedule, restoring unbooked slots for dates no longer on leave
        slotGenerator.regenerate(d.getId(), 14);
    }

    // ---------- Forward Slot Inventory & Availability ----------

    @Transactional
    public List<DoctorSlotDetailResponse> getMySlots(UUID userId, int days) {
        Doctor d = findByUserId(userId);
        int horizon = (days > 0 && days <= 60) ? days : 14;
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime until = now.plusDays(horizon);

        List<DoctorSlot> slots = slotRepository.findSlotsInRange(d.getId(), now, until);
        if (slots.isEmpty()) {
            slotGenerator.regenerate(d.getId(), horizon);
            slots = slotRepository.findSlotsInRange(d.getId(), now, until);
        }

        List<DoctorLeave> leaves = leaveRepository.findByDoctorIdOrderByStartDateAsc(d.getId());

        List<UUID> bookedSlotIds = slots.stream().filter(DoctorSlot::isBooked).map(DoctorSlot::getId).toList();
        Map<UUID, Appointment> apptMap = bookedSlotIds.isEmpty() ? Map.of() :
                appointmentRepository.findBySlotIdIn(bookedSlotIds).stream()
                        .collect(Collectors.toMap(Appointment::getSlotId, a -> a, (a1, a2) -> a1));

        List<UUID> patientIds = apptMap.values().stream().map(Appointment::getPatientId).distinct().toList();
        Map<UUID, User> patientMap = patientIds.isEmpty() ? Map.of() :
                userRepository.findAllById(patientIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        return slots.stream().map(s -> {
            LocalDate date = s.getSlotAt().toLocalDate();
            DoctorLeave matchingLeave = leaves.stream()
                    .filter(l -> !date.isBefore(l.getStartDate()) && !date.isAfter(l.getEndDate()))
                    .findFirst().orElse(null);
            boolean onLeave = matchingLeave != null;
            String leaveReason = onLeave ? matchingLeave.getReason() : null;

            Appointment appt = apptMap.get(s.getId());
            User patient = appt != null ? patientMap.get(appt.getPatientId()) : null;
            String patientName = patient != null ? patient.getFullName() : null;
            UUID apptId = appt != null ? appt.getId() : null;
            AppointmentStatus apptStatus = appt != null ? appt.getStatus() : null;

            return new DoctorSlotDetailResponse(
                    s.getId(),
                    s.getDoctorId(),
                    s.getSlotAt(),
                    s.isBooked(),
                    s.isAvailable(),
                    apptId,
                    patientName,
                    apptStatus,
                    onLeave,
                    leaveReason
            );
        }).toList();
    }

    @Transactional
    public DoctorSlotDetailResponse toggleSlotAvailability(UUID userId, UUID slotId) {
        Doctor d = findByUserId(userId);
        DoctorSlot s = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", slotId));
        if (!s.getDoctorId().equals(d.getId())) {
            throw new BusinessRuleException("Cannot modify another doctor's slot");
        }
        if (s.isBooked()) {
            throw new BusinessRuleException("Cannot change availability of a booked slot");
        }

        s.setAvailable(!s.isAvailable());
        DoctorSlot saved = slotRepository.save(s);

        LocalDate date = saved.getSlotAt().toLocalDate();
        DoctorLeave matchingLeave = leaveRepository.findByDoctorIdOrderByStartDateAsc(d.getId()).stream()
                .filter(l -> !date.isBefore(l.getStartDate()) && !date.isAfter(l.getEndDate()))
                .findFirst().orElse(null);

        return new DoctorSlotDetailResponse(
                saved.getId(),
                saved.getDoctorId(),
                saved.getSlotAt(),
                saved.isBooked(),
                saved.isAvailable(),
                null,
                null,
                null,
                matchingLeave != null,
                matchingLeave != null ? matchingLeave.getReason() : null
        );
    }

    @Transactional
    public DoctorSlot addAdHocSlot(UUID userId, OffsetDateTime slotAt) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() == DoctorStatus.PENDING) {
            throw new BusinessRuleException("Slots are locked while pending admin review");
        }
        if (slotAt.isBefore(OffsetDateTime.now())) {
            throw new BusinessRuleException("Slot time must be in the future");
        }
        LocalDate date = slotAt.toLocalDate();
        if (leaveRepository.existsByDoctorIdAndDateInRange(d.getId(), date)) {
            throw new BusinessRuleException("Cannot add slot on a marked leave date (" + date + ")");
        }
        return slotRepository.save(DoctorSlot.builder()
                .doctorId(d.getId())
                .slotAt(slotAt)
                .booked(false)
                .available(true)
                .build());
    }

    @Transactional
    public void deleteSlot(UUID userId, UUID slotId) {
        Doctor d = findByUserId(userId);
        DoctorSlot s = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", slotId));
        if (!s.getDoctorId().equals(d.getId())) {
            throw new BusinessRuleException("Cannot delete another doctor's slot");
        }
        if (s.isBooked()) {
            throw new BusinessRuleException("Cannot delete a booked slot");
        }
        slotRepository.delete(s);
    }

    // ---------- helpers ----------

    private Doctor findByUserId(UUID userId) {
        return doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile for user", userId));
    }

    private DoctorLeaveDto toLeaveDto(DoctorLeave l) {
        return new DoctorLeaveDto(l.getId(), l.getDoctorId(), l.getStartDate(), l.getEndDate(), l.getReason(), l.getCreatedAt());
    }

    private DoctorMeResponse toResponse(Doctor d, List<ScheduleTemplateDto> templates, List<DoctorLeaveDto> leaves) {
        return new DoctorMeResponse(
                d.getId(), d.getUserId(), d.getFullName(), d.getSpecialty(), d.getHospital(),
                d.getHospitalId(), d.getAvatarUrl(), d.getRating(),
                d.getReviewCount() != null ? d.getReviewCount() : 0,
                d.getBio(), d.getStatus(),
                d.getRegistrationNumber(), d.getYearsExperience(), d.getConsultationFee(),
                d.getLanguages(), d.getRejectionReason(), d.getSubmittedAt(), d.getReviewedAt(),
                templates, null, null, null, null, leaves);
    }
}
