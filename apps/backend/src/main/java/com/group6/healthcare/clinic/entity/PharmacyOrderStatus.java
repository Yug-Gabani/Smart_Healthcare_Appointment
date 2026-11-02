package com.group6.healthcare.clinic.entity;

/**
 * Lifecycle of a patient-initiated pharmacy order.
 *
 * <pre>
 *   NEW ──> DISPENSED ──> PICKED_UP  (terminal)
 *     └────> CANCELLED              (patient while NEW, pharmacist pre-PICKED_UP)
 * </pre>
 */
public enum PharmacyOrderStatus {
    NEW,
    DISPENSED,
    PICKED_UP,
    CANCELLED
}
