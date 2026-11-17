package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.ScheduleTemplateDto;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorScheduleTemplateRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AdminDoctorService {

    private final DoctorRepository doctorRepository;
    private final DoctorScheduleTemplateRepository templateRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;

    public AdminDoctorService(DoctorRepository doctorRepository,
                              DoctorScheduleTemplateRepository templateRepository,
                              UserRepository userRepository,
                              AppointmentRepository appointmentRepository) {
        this.doctorRepository = doctorRepository;
        this.templateRepository = templateRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional(readOnly = true)
    public List<DoctorMeResponse> listByStatus(DoctorStatus status) {
        if (status == null) {
            return doctorRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
        }
        return doctorRepository.findByStatus(status).stream().map(this::toResponse).toList();
    }

    @Transactional
    public DoctorMeResponse approve(UUID doctorId, UUID adminUserId) {
        Doctor d = findById(doctorId);
        if (d.getStatus() == DoctorStatus.APPROVED) {
            throw new BusinessRuleException("Doctor is already approved");
        }
        d.setStatus(DoctorStatus.APPROVED);
        d.setRejectionReason(null);
        d.setReviewedAt(OffsetDateTime.now());
        d.setReviewedBy(adminUserId);
        doctorRepository.save(d);
        return toResponse(d);
    }

    @Transactional
    public DoctorMeResponse reject(UUID doctorId, UUID adminUserId, String reason) {
        Doctor d = findById(doctorId);
        if (d.getStatus() == DoctorStatus.REJECTED) {
            throw new BusinessRuleException("Doctor is already rejected");
        }
        d.setStatus(DoctorStatus.REJECTED);
        d.setRejectionReason(reason);
        d.setReviewedAt(OffsetDateTime.now());
        d.setReviewedBy(adminUserId);
        doctorRepository.save(d);
        return toResponse(d);
    }

    @Transactional
    public DoctorMeResponse suspend(UUID doctorId, UUID adminUserId, String reason) {
        Doctor d = findById(doctorId);
        if (d.getStatus() == DoctorStatus.SUSPENDED) {
            throw new BusinessRuleException("Doctor is already suspended");
        }
        d.setStatus(DoctorStatus.SUSPENDED);
        d.setRejectionReason(reason);
        d.setReviewedAt(OffsetDateTime.now());
        d.setReviewedBy(adminUserId);
        doctorRepository.save(d);
        return toResponse(d);
    }

    @Transactional
    public DoctorMeResponse reinstate(UUID doctorId, UUID adminUserId) {
        Doctor d = findById(doctorId);
        if (d.getStatus() == DoctorStatus.APPROVED) {
            throw new BusinessRuleException("Doctor is already active and approved");
        }
        d.setStatus(DoctorStatus.APPROVED);
        d.setRejectionReason(null);
        d.setReviewedAt(OffsetDateTime.now());
        d.setReviewedBy(adminUserId);
        doctorRepository.save(d);
        return toResponse(d);
    }

    private Doctor findById(UUID doctorId) {
        return doctorRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", doctorId));
    }

    private DoctorMeResponse toResponse(Doctor d) {
        List<ScheduleTemplateDto> templates = templateRepository
                .findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(d.getId())
                .stream()
                .map(t -> new ScheduleTemplateDto(
                        t.getId(), t.getDayOfWeek(), t.getStartTime(), t.getEndTime(),
                        t.getSlotDurationMinutes()))
                .toList();

        String email = null;
        String phone = null;
        if (d.getUserId() != null) {
            User user = userRepository.findById(d.getUserId()).orElse(null);
            if (user != null) {
                email = user.getEmail();
                phone = user.getPhone();
            }
        }

        long totalAppointments = appointmentRepository.countByDoctorId(d.getId());
        long completedConsultations = appointmentRepository.countByDoctorIdAndStatus(d.getId(), AppointmentStatus.COMPLETED);

        return new DoctorMeResponse(
                d.getId(), d.getUserId(), d.getFullName(), d.getSpecialty(), d.getHospital(),
                d.getHospitalId(), d.getAvatarUrl(), d.getRating(),
                d.getReviewCount() != null ? d.getReviewCount() : 0,
                d.getBio(), d.getStatus(),
                d.getRegistrationNumber(), d.getYearsExperience(), d.getConsultationFee(),
                d.getLanguages(), d.getRejectionReason(), d.getSubmittedAt(), d.getReviewedAt(),
                templates, email, phone, totalAppointments, completedConsultations);
    }
}
