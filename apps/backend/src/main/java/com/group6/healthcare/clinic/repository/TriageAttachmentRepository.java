package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.TriageAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TriageAttachmentRepository extends JpaRepository<TriageAttachment, UUID> {
    List<TriageAttachment> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
    List<TriageAttachment> findByAppointmentId(UUID appointmentId);
    List<TriageAttachment> findByAssessmentId(UUID assessmentId);
    List<TriageAttachment> findByIdIn(List<UUID> ids);
}
