package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.clinic.dto.HospitalResponse;
import com.group6.healthcare.clinic.service.HospitalService;
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
@RequestMapping("/api/v1/hospitals")
@Tag(name = "Hospitals", description = "Hospital directory + fuzzy search (FR-03)")
public class HospitalController {

    private final HospitalService hospitalService;

    public HospitalController(HospitalService hospitalService) {
        this.hospitalService = hospitalService;
    }

    // ===== Authenticated endpoints (full detail: phone, address, etc.) =====

    @GetMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Search hospitals with optional name/state/city/specialty filters")
    public ApiResponse<List<HospitalResponse>> search(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "state", required = false) String state,
            @RequestParam(name = "city", required = false) String city,
            @RequestParam(name = "specialty", required = false) String specialty,
            @RequestParam(name = "limit", defaultValue = "25") int limit) {
        return ApiResponse.ok(hospitalService.search(q, state, city, specialty, limit));
    }

    @GetMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Fetch a single hospital by id")
    public ApiResponse<HospitalResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(hospitalService.get(id));
    }

    @GetMapping("/states")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List all distinct states for filter dropdown")
    public ApiResponse<List<String>> states() {
        return ApiResponse.ok(hospitalService.distinctStates());
    }

    @GetMapping("/cities")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List distinct cities (optionally scoped to a state)")
    public ApiResponse<List<String>> cities(@RequestParam(name = "state", required = false) String state) {
        return ApiResponse.ok(hospitalService.distinctCities(state));
    }

    // ===== Public endpoints (landing-page preview, no auth) =====

    @GetMapping("/public/search")
    @Operation(summary = "Public landing-page search. No PII; limited to ~10 light results.")
    public ApiResponse<List<HospitalResponse>> publicSearch(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "city", required = false) String city,
            @RequestParam(name = "limit", defaultValue = "8") int limit) {
        int bounded = Math.max(1, Math.min(limit, 15));
        return ApiResponse.ok(hospitalService.search(q, null, city, null, bounded));
    }

    @GetMapping("/public/{id}")
    @Operation(summary = "Public hospital preview — name, location, specialties.")
    public ApiResponse<HospitalResponse> publicGet(@PathVariable UUID id) {
        return ApiResponse.ok(hospitalService.get(id));
    }
}
