package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.TriageAssessment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TriageAssessmentRepository extends JpaRepository<TriageAssessment, UUID> {

    List<TriageAssessment> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
