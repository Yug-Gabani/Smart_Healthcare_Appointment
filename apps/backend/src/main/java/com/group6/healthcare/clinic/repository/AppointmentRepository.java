package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    List<Appointment> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<Appointment> findByDoctorIdAndStatusInOrderByCreatedAtDesc(UUID doctorId,
                                                                   List<AppointmentStatus> statuses);

    long countByStatus(AppointmentStatus status);

    long countByDoctorId(UUID doctorId);

    long countByDoctorIdAndStatus(UUID doctorId, AppointmentStatus status);

    List<Appointment> findAllByOrderByCreatedAtDesc();

    Page<Appointment> findByCreatedAtBetween(OffsetDateTime from, OffsetDateTime to, Pageable pageable);

    Page<Appointment> findByCreatedAtBetweenAndStatus(OffsetDateTime from, OffsetDateTime to,
                                                      AppointmentStatus status, Pageable pageable);
}
