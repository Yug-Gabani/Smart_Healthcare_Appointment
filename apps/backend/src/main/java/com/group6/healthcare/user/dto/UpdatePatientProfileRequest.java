package com.group6.healthcare.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdatePatientProfileRequest(
        @Size(min = 1, max = 255) String fullName,
        @Size(max = 50)
        @Pattern(
                regexp = "^(?:\\+?[0-9](?:[\\s\\-()]{0,2}[0-9]){6,14})?$",
                message = "Please enter a valid phone number (7-15 digits, optional + prefix)"
        )
        String phone,
        LocalDate dateOfBirth,
        @Pattern(regexp = "MALE|FEMALE|OTHER|PREFER_NOT_TO_SAY", message = "invalid gender")
        String gender,
        String addressStreet,
        @Size(max = 128) String addressCity,
        @Size(max = 128) String addressState,
        @Size(max = 16) String addressPincode,
        @Size(max = 255) String emergencyContactName,
        @Size(max = 50)
        @Pattern(
                regexp = "^(?:\\+?[0-9](?:[\\s\\-()]{0,2}[0-9]){6,14})?$",
                message = "Please enter a valid emergency contact phone number (7-15 digits, optional + prefix)"
        )
        String emergencyContactPhone,
        /* Self-reported health info (V19). bloodGroup is constrained to the eight
         * standard groups + UNKNOWN or empty; allergies & conditions are free-text. */
        @Pattern(regexp = "A\\+|A-|B\\+|B-|AB\\+|AB-|O\\+|O-|UNKNOWN|", message = "invalid blood group")
        String bloodGroup,
        @Size(max = 2000) String allergies,
        @Size(max = 2000) String conditions
) {}
