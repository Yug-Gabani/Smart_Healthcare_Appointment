package com.group6.healthcare.clinic.dto;

import java.util.List;
import java.util.UUID;

public record HospitalResponse(
        UUID id,
        String name,
        String address,
        String city,
        String state,
        String pincode,
        String phone,
        /** Specialties parsed out of the CSV blob (comma-separated, cleaned). */
        List<String> specialties,
        String logoUrl
) {}
