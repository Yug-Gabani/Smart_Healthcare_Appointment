package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.ReplaceScheduleRequest;
import com.group6.healthcare.clinic.dto.ScheduleTemplateDto;
import com.group6.healthcare.clinic.dto.UpdateDoctorProfileRequest;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorScheduleTemplate;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorScheduleTemplateRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class DoctorProfileService {

    private final DoctorRepository doctorRepository;
    private final DoctorScheduleTemplateRepository templateRepository;
    private final DoctorSlotRepository slotRepository;
    private final SlotGeneratorService slotGenerator;

    public DoctorProfileService(DoctorRepository doctorRepository,
                                DoctorScheduleTemplateRepository templateRepository,
                                DoctorSlotRepository slotRepository,
                                SlotGeneratorService slotGenerator) {
        this.doctorRepository = doctorRepository;
        this.templateRepository = templateRepository;
        this.slotRepository = slotRepository;
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
        slotGenerator.regenerate(d.getId());
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

    // ---------- helpers ----------

    private Doctor findByUserId(UUID userId) {
        return doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile for user", userId));
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
