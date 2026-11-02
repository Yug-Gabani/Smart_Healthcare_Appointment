package com.group6.healthcare.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "triage_assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TriageAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "chief_complaint", nullable = false)
    private String chiefComplaint;

    @Column(name = "symptoms_json", nullable = false)
    private String symptomsJson;

    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    @Column(name = "pain_level", nullable = false)
    private int painLevel;

    @Column(name = "has_fever", nullable = false)
    private boolean fever;

    @Column(name = "has_chest_pain", nullable = false)
    private boolean chestPain;

    @Column(name = "has_shortness_of_breath", nullable = false)
    private boolean shortnessOfBreath;

    @Enumerated(EnumType.STRING)
    @Column(name = "urgency", nullable = false, length = 16)
    private Urgency urgency;

    @Column(name = "rationale", nullable = false)
    private String rationale;

    @Column(name = "suggested_specialty", nullable = false, length = 128)
    private String suggestedSpecialty;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
