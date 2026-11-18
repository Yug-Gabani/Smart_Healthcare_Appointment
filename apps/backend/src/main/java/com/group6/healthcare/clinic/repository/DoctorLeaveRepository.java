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

    @Query("SELECT dl FROM DoctorLeave dl WHERE dl.doctorId = :doctorId AND dl.endDate >= :from AND dl.startDate <= :to ORDER BY dl.startDate ASC")
    List<DoctorLeave> findOverlappingLeaves(@Param("doctorId") UUID doctorId,
                                           @Param("from") LocalDate from,
                                           @Param("to") LocalDate to);

    @Query("SELECT COUNT(dl) > 0 FROM DoctorLeave dl WHERE dl.doctorId = :doctorId AND :targetDate BETWEEN dl.startDate AND dl.endDate")
    boolean isDoctorOnLeave(@Param("doctorId") UUID doctorId, @Param("targetDate") LocalDate targetDate);
}
