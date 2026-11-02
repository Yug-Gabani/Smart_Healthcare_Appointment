package com.group6.healthcare.clinic.dto;

public record ConsultationEndRequest(
        String transcript,
        String doctorNotes,
        String observations,
        String prescribedActions,
        String followUp
) {
}
