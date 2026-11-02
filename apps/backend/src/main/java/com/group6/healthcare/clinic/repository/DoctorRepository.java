package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DoctorRepository extends JpaRepository<Doctor, UUID> {

    @Query("SELECT d FROM Doctor d WHERE LOWER(d.specialty) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "ORDER BY d.rating DESC, d.fullName ASC")
    List<Doctor> searchBySpecialty(@Param("q") String specialtyQuery);

    List<Doctor> findAllByOrderByRatingDescFullNameAsc();

    List<Doctor> findByHospitalIdOrderByRatingDescFullNameAsc(UUID hospitalId);

    @Query("""
        SELECT d FROM Doctor d
         WHERE d.status = com.group6.healthcare.clinic.entity.DoctorStatus.APPROVED
           AND (:specialty IS NULL OR LOWER(d.specialty) LIKE LOWER(CONCAT('%', :specialty, '%')))
           AND (:hospitalId IS NULL OR d.hospitalId = :hospitalId)
         ORDER BY d.rating DESC, d.fullName ASC
        """)
    List<Doctor> searchByFilters(@Param("specialty") String specialty,
                                 @Param("hospitalId") UUID hospitalId);

    @Query("""
        SELECT d FROM Doctor d
         WHERE d.status = com.group6.healthcare.clinic.entity.DoctorStatus.APPROVED
         ORDER BY d.rating DESC, d.fullName ASC
        """)
    List<Doctor> findApprovedOrderByRatingDescFullNameAsc();

    @Query("""
        SELECT d FROM Doctor d
         WHERE d.status = com.group6.healthcare.clinic.entity.DoctorStatus.APPROVED
           AND d.hospitalId = :hospitalId
         ORDER BY d.rating DESC, d.fullName ASC
        """)
    List<Doctor> findApprovedByHospitalId(@Param("hospitalId") UUID hospitalId);

    @Query("""
        SELECT d FROM Doctor d
         WHERE d.status = :status
         ORDER BY d.submittedAt ASC NULLS LAST, d.createdAt ASC
        """)
    List<Doctor> findByStatus(@Param("status") com.group6.healthcare.clinic.entity.DoctorStatus status);

    Optional<Doctor> findByUserId(UUID userId);
}
