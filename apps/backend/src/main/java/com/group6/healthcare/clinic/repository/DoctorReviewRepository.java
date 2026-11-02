package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.DoctorReview;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorReviewRepository extends JpaRepository<DoctorReview, UUID> {
    Optional<DoctorReview> findByAppointmentId(UUID appointmentId);
    List<DoctorReview> findByDoctorIdOrderByCreatedAtDesc(UUID doctorId);
    List<DoctorReview> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    @Query("SELECT r FROM DoctorReview r WHERE r.rating >= 4 ORDER BY r.createdAt DESC")
    List<DoctorReview> findFeaturedReviews(Pageable pageable);

    boolean existsByAppointmentId(UUID appointmentId);
}
