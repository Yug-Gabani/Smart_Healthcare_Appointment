package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.CreateReviewRequest;
import com.group6.healthcare.clinic.dto.DoctorReviewResponse;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorReview;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorReviewRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DoctorReviewService {

    private final DoctorReviewRepository reviewRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    public DoctorReviewService(
            DoctorReviewRepository reviewRepository,
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            UserRepository userRepository) {
        this.reviewRepository = reviewRepository;
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public DoctorReviewResponse createReview(UUID patientId, UUID appointmentId, CreateReviewRequest req) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));

        if (!appt.getPatientId().equals(patientId)) {
            throw new BusinessRuleException("You can only review your own appointments");
        }

        if (appt.getStatus() != AppointmentStatus.COMPLETED) {
            throw new BusinessRuleException("Reviews can only be submitted for completed consultations");
        }

        if (reviewRepository.existsByAppointmentId(appointmentId)) {
            throw new BusinessRuleException("A review has already been submitted for this appointment");
        }

        Doctor doctor = doctorRepository.findById(appt.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", appt.getDoctorId()));

        User patient = userRepository.findById(patientId).orElse(null);
        String patientName = (patient != null && patient.getFullName() != null) ? patient.getFullName() : "Patient";
        if (req.isAnonymous()) {
            patientName = "Verified Patient";
        }

        DoctorReview review = DoctorReview.builder()
                .appointmentId(appointmentId)
                .doctorId(doctor.getId())
                .patientId(patientId)
                .patientName(patientName)
                .rating(req.rating())
                .comment(req.comment())
                .tags(req.tags())
                .isAnonymous(req.isAnonymous())
                .build();

        DoctorReview saved = reviewRepository.save(review);

        // Update doctor rating aggregate
        int currentCount = doctor.getReviewCount() != null ? doctor.getReviewCount() : 0;
        BigDecimal currentRating = doctor.getRating() != null ? doctor.getRating() : BigDecimal.valueOf(5.0);
        double totalScore = (currentRating.doubleValue() * currentCount) + req.rating();
        int newCount = currentCount + 1;
        double newAvg = totalScore / newCount;

        doctor.setRating(BigDecimal.valueOf(newAvg).setScale(2, RoundingMode.HALF_UP));
        doctor.setReviewCount(newCount);
        doctorRepository.save(doctor);

        return toResponse(saved, doctor.getFullName(), doctor.getSpecialty());
    }

    @Transactional(readOnly = true)
    public List<DoctorReviewResponse> getReviewsForDoctor(UUID doctorId) {
        Doctor doctor = doctorRepository.findById(doctorId).orElse(null);
        String docName = doctor != null ? doctor.getFullName() : null;
        String docSpecialty = doctor != null ? doctor.getSpecialty() : null;

        return reviewRepository.findByDoctorIdOrderByCreatedAtDesc(doctorId).stream()
                .map(r -> toResponse(r, docName, docSpecialty))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DoctorReviewResponse> getFeaturedReviewsForLanding(int limit) {
        List<DoctorReview> featured = reviewRepository.findFeaturedReviews(PageRequest.of(0, Math.max(1, limit)));
        if (featured.isEmpty()) return List.of();

        List<UUID> docIds = featured.stream().map(DoctorReview::getDoctorId).distinct().toList();
        Map<UUID, Doctor> docsById = doctorRepository.findAllById(docIds).stream()
                .collect(Collectors.toMap(Doctor::getId, d -> d));

        return featured.stream()
                .map(r -> {
                    Doctor d = docsById.get(r.getDoctorId());
                    return toResponse(r, d != null ? d.getFullName() : "Specialist", d != null ? d.getSpecialty() : "Consultant");
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public DoctorReviewResponse getReviewForAppointment(UUID appointmentId) {
        return reviewRepository.findByAppointmentId(appointmentId)
                .map(r -> {
                    Doctor d = doctorRepository.findById(r.getDoctorId()).orElse(null);
                    return toResponse(r, d != null ? d.getFullName() : null, d != null ? d.getSpecialty() : null);
                })
                .orElse(null);
    }

    private DoctorReviewResponse toResponse(DoctorReview r, String docName, String docSpecialty) {
        return new DoctorReviewResponse(
                r.getId(),
                r.getAppointmentId(),
                r.getDoctorId(),
                docName,
                docSpecialty,
                r.isAnonymous() ? "Verified Patient" : r.getPatientName(),
                r.getRating(),
                r.getComment(),
                r.getTags(),
                r.isAnonymous(),
                r.getCreatedAt()
        );
    }
}
