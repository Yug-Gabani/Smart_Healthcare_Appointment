package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.ConsultationSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConsultationSessionRepository extends JpaRepository<ConsultationSession, UUID> {

    Optional<ConsultationSession> findByAppointmentId(UUID appointmentId);

    Optional<ConsultationSession> findByRoomId(String roomId);
}
