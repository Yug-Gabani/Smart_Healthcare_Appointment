package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.CreateDoctorLeaveRequest;
import com.group6.healthcare.clinic.dto.DoctorLeaveResponse;
import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.ReplaceScheduleRequest;
import com.group6.healthcare.clinic.dto.ScheduleTemplateDto;
import com.group6.healthcare.clinic.dto.UpdateDoctorProfileRequest;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorLeave;
import com.group6.healthcare.clinic.entity.DoctorScheduleTemplate;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.DoctorLeaveRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorScheduleTemplateRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class DoctorProfileService {

    private final DoctorRepository doctorRepository;
    private final DoctorScheduleTemplateRepository templateRepository;
    private final DoctorSlotRepository slotRepository;
    private final DoctorLeaveRepository leaveRepository;
    private final SlotGeneratorService slotGenerator;

    @PersistenceContext
    private EntityManager em;

    public DoctorProfileService(DoctorRepository doctorRepository,
                                DoctorScheduleTemplateRepository templateRepository,
                                DoctorSlotRepository slotRepository,
                                DoctorLeaveRepository leaveRepository,
                                SlotGeneratorService slotGenerator) {
        this.doctorRepository = doctorRepository;
        this.templateRepository = templateRepository;
        this.slotRepository = slotRepository;
        this.leaveRepository = leaveRepository;
        this.slotGenerator = slotGenerator;
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
        return toResponse(d, templates);
    }

    @Transactional
    public DoctorMeResponse updateMyProfile(UUID userId, UpdateDoctorProfileRequest req) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() == DoctorStatus.PENDING) {
            throw new BusinessRuleException("Profile is locked while pending admin review");
        }
        if (req.fullName() != null)           d.setFullName(req.fullName());
        if (req.specialty() != null)          d.setSpecialty(req.specialty());
        if (req.hospitalName() != null)       d.setHospital(req.hospitalName());
        if (req.hospitalId() != null)         d.setHospitalId(req.hospitalId());
        if (req.bio() != null)                d.setBio(req.bio());
        if (req.avatarUrl() != null)          d.setAvatarUrl(req.avatarUrl());
        if (req.registrationNumber() != null) d.setRegistrationNumber(req.registrationNumber());
        if (req.yearsExperience() != null)    d.setYearsExperience(req.yearsExperience());
        if (req.consultationFee() != null)    d.setConsultationFee(req.consultationFee());
        if (req.languages() != null)          d.setLanguages(req.languages());
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

    @Transactional
    public DoctorSlot addAdHocSlot(UUID userId, OffsetDateTime slotAt) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() == DoctorStatus.PENDING) {
            throw new BusinessRuleException("Slots are locked while pending admin review");
        }
        if (slotAt.isBefore(OffsetDateTime.now())) {
            throw new BusinessRuleException("Slot time must be in the future");
        }
        return slotRepository.save(DoctorSlot.builder()
                .doctorId(d.getId())
                .slotAt(slotAt)
                .booked(false)
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

    // ---------- Doctor Vacations / Leaves ----------

    @Transactional
    public DoctorLeaveResponse createLeave(UUID userId, CreateDoctorLeaveRequest req) {
        Doctor d = findByUserId(userId);
        if (d.getStatus() == DoctorStatus.PENDING) {
            throw new BusinessRuleException("Leaves cannot be marked while pending admin review");
        }
        if (req.startDate().isAfter(req.endDate())) {
            throw new BusinessRuleException("Start date cannot be after end date");
        }
        if (req.endDate().isBefore(LocalDate.now())) {
            throw new BusinessRuleException("Leave end date cannot be in the past");
        }

        DoctorLeave leave = DoctorLeave.builder()
                .doctorId(d.getId())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .reason(req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : "Scheduled leave")
                .build();
        leave = leaveRepository.save(leave);

        // Immediately delete any unbooked slots falling on the leave dates so they cannot be booked
        OffsetDateTime from = req.startDate().atStartOfDay().atOffset(OffsetDateTime.now().getOffset());
        OffsetDateTime to = req.endDate().atTime(23, 59, 59, 999_999_999).atOffset(OffsetDateTime.now().getOffset());
        slotRepository.deleteUnbookedSlotsBetween(d.getId(), from, to);

        // Regenerate the forward 14-day window to maintain consistent availability without leave dates
        slotGenerator.regenerate(d.getId(), 14);

        return toLeaveResponse(leave);
    }

    @Transactional(readOnly = true)
    public List<DoctorLeaveResponse> listLeaves(UUID userId) {
        Doctor d = findByUserId(userId);
        return leaveRepository.findByDoctorIdOrderByStartDateAsc(d.getId())
                .stream()
                .map(this::toLeaveResponse)
                .toList();
    }

    @Transactional
    public void deleteLeave(UUID userId, UUID leaveId) {
        Doctor d = findByUserId(userId);
        DoctorLeave leave = leaveRepository.findById(leaveId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor leave", leaveId));
        if (!leave.getDoctorId().equals(d.getId())) {
            throw new BusinessRuleException("Cannot delete another doctor's leave");
        }
        leaveRepository.delete(leave);

        // Regenerate the forward 14-day window, restoring unbooked slots for previously suppressed dates
        slotGenerator.regenerate(d.getId(), 14);
    }

    // ---------- helpers ----------

    private Doctor findByUserId(UUID userId) {
        return doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile for user", userId));
    }

    private DoctorLeaveResponse toLeaveResponse(DoctorLeave l) {
        return new DoctorLeaveResponse(
                l.getId(),
                l.getDoctorId(),
                l.getStartDate(),
                l.getEndDate(),
                l.getReason(),
                l.getCreatedAt()
        );
    }

    private DoctorMeResponse toResponse(Doctor d, List<ScheduleTemplateDto> templates) {
        return new DoctorMeResponse(
                d.getId(), d.getUserId(), d.getFullName(), d.getSpecialty(), d.getHospital(),
                d.getHospitalId(), d.getAvatarUrl(), d.getRating(),
                d.getReviewCount() != null ? d.getReviewCount() : 0,
                d.getBio(), d.getStatus(),
                d.getRegistrationNumber(), d.getYearsExperience(), d.getConsultationFee(),
                d.getLanguages(), d.getRejectionReason(), d.getSubmittedAt(), d.getReviewedAt(),
                templates);
    }
}
