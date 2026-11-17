package com.group6.healthcare.clinic.dto;

public record ConsultationEndRequest(
        String transcript,
        String doctorNotes,
        String observations,
        String prescribedActions,
        String followUp,
        Boolean patientConsentTranscription,
        Boolean doctorConsentTranscription,
        String patientSymptoms,
        String discussionPoints
) {
    public ConsultationEndRequest(
            String transcript,
            String doctorNotes,
            String observations,
            String prescribedActions,
            String followUp
    ) {
        this(transcript, doctorNotes, observations, prescribedActions, followUp, null, null, null, null);
    }
}
