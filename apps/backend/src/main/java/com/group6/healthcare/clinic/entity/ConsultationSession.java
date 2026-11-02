package com.group6.healthcare.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA entity representing a live telehealth consultation room session and its
 * archived post-visit structured clinical summary.
 */
@Entity
@Table(name = "consultation_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsultationSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "appointment_id", nullable = false, unique = true)
    private UUID appointmentId;

    @Column(name = "room_id", nullable = false, unique = true, length = 64)
    private String roomId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ConsultationSessionStatus status;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    @Column(name = "transcript", columnDefinition = "TEXT")
    private String transcript;

    @Column(name = "summary_chief_complaint", columnDefinition = "TEXT")
    private String summaryChiefComplaint;

    @Column(name = "summary_observations", columnDefinition = "TEXT")
    private String summaryObservations;

    @Column(name = "summary_doctor_advice", columnDefinition = "TEXT")
    private String summaryDoctorAdvice;

    @Column(name = "summary_prescribed_actions", columnDefinition = "TEXT")
    private String summaryPrescribedActions;

    @Column(name = "summary_follow_up", columnDefinition = "TEXT")
    private String summaryFollowUp;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (status == null) status = ConsultationSessionStatus.SCHEDULED;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
