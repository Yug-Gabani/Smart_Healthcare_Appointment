package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.Prescription;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    List<Prescription> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<Prescription> findByAppointmentIdOrderByCreatedAtAsc(UUID appointmentId);

    Optional<Prescription> findFirstByAppointmentIdAndStatusInOrderByCreatedAtDesc(
            UUID appointmentId, List<PrescriptionStatus> statuses);
}
