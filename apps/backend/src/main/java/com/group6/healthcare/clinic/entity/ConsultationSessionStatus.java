package com.group6.healthcare.clinic.entity;

/**
 * Lifecycle state of a video consultation session.
 * SCHEDULED: Appointment booked, waiting for the consultation time window or doctor initiation.
 * WAITING: Doctor or patient has entered the room, waiting for peer to connect.
 * IN_PROGRESS: Both peers connected, active consultation in session.
 * COMPLETED: Session concluded, transcript processed, and post-visit summary generated.
 */
public enum ConsultationSessionStatus {
    SCHEDULED,
    WAITING,
    IN_PROGRESS,
    COMPLETED
}
