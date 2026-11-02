package com.group6.healthcare.clinic.dto;

import java.util.UUID;

public record ConsultationSignalMessage(
        String type,
        UUID senderId,
        String senderRole,
        String payload,
        long timestamp
) {
}
