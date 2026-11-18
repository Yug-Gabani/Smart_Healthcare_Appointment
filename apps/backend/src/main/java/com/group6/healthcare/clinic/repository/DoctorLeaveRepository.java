package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.DoctorLeave;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface DoctorLeaveRepository extends JpaRepository<DoctorLeave, UUID> {

    List<DoctorLeave> findByDoctorIdOrderByStartDateAsc(UUID doctorId);

    @Query("SELECT l FROM DoctorLeave l WHERE l.doctorId = :doctorId AND l.endDate >= :today ORDER BY l.startDate ASC")
    List<DoctorLeave> findUpcomingLeaves(@Param("doctorId") UUID doctorId, @Param("today") LocalDate today);

    @Query("SELECT COUNT(l) > 0 FROM DoctorLeave l WHERE l.doctorId = :doctorId AND :date >= l.startDate AND :date <= l.endDate")
    boolean existsByDoctorIdAndDateInRange(@Param("doctorId") UUID doctorId, @Param("date") LocalDate date);

    @Query("SELECT l FROM DoctorLeave l WHERE l.doctorId = :doctorId AND l.startDate <= :endDate AND l.endDate >= :startDate ORDER BY l.startDate ASC")
    List<DoctorLeave> findOverlappingLeaves(@Param("doctorId") UUID doctorId,
                                            @Param("startDate") LocalDate startDate,
                                            @Param("endDate") LocalDate endDate);
}
