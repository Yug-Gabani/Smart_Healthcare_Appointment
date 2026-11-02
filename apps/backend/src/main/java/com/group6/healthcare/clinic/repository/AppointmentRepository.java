package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    List<Appointment> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<Appointment> findByDoctorIdAndStatusInOrderByCreatedAtDesc(UUID doctorId,
                                                                   List<AppointmentStatus> statuses);
}
