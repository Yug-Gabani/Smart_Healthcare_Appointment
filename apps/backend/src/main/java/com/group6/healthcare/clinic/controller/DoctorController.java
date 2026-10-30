package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.clinic.dto.DoctorResponse;
import com.group6.healthcare.clinic.dto.SlotResponse;
import com.group6.healthcare.clinic.service.DoctorService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctors")
@Tag(name = "Doctors", description = "Clinical directory + slot availability (FR-03, FR-04)")
@SecurityRequirement(name = "bearerAuth")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @GetMapping
    @Operation(summary = "List doctors, optionally filtered by specialty substring and/or hospital id")
    public ApiResponse<List<DoctorResponse>> list(
            @RequestParam(name = "specialty", required = false) String specialty,
            @RequestParam(name = "hospitalId", required = false) UUID hospitalId) {
        return ApiResponse.ok(doctorService.listDoctors(specialty, hospitalId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Fetch a single doctor with the next 8 open slots")
    public ApiResponse<DoctorResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(doctorService.getDoctor(id));
    }

    @GetMapping("/{id}/slots")
    @Operation(summary = "List all open slots for a doctor (from now, ordered ascending)")
    public ApiResponse<List<SlotResponse>> slots(@PathVariable UUID id) {
        return ApiResponse.ok(doctorService.listOpenSlots(id));
    }
}
