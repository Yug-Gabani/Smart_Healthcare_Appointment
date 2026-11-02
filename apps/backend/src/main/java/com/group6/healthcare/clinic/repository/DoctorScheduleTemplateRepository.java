package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.DoctorScheduleTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DoctorScheduleTemplateRepository extends JpaRepository<DoctorScheduleTemplate, UUID> {

    List<DoctorScheduleTemplate> findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(UUID doctorId);

    @Modifying
    @Query("DELETE FROM DoctorScheduleTemplate t WHERE t.doctorId = :doctorId")
    void deleteByDoctorId(@Param("doctorId") UUID doctorId);
}
