package com.group6.healthcare.clinic.entity;

/**
 * Admin-controlled visibility gate for doctor accounts.
 *
 * <ul>
 *   <li>{@link #PENDING}  — just signed up or re-submitted; invisible to patients, profile is read-only.</li>
 *   <li>{@link #APPROVED} — admin verified; appears in all patient-facing searches.</li>
 *   <li>{@link #REJECTED} — admin rejected; invisible, doctor can edit and resubmit.</li>
 * </ul>
 */
public enum DoctorStatus {
    PENDING,
    APPROVED,
    REJECTED
}
