package com.group6.healthcare.user.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.dto.PatientProfileResponse;
import com.group6.healthcare.user.dto.UpdatePatientProfileRequest;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/me/profile")
@Tag(name = "Patient Profile", description = "Patient-editable profile fields (FR-02)")
@SecurityRequirement(name = "bearerAuth")
public class PatientProfileController {

    private final UserRepository userRepository;

    public PatientProfileController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    @Operation(summary = "Fetch the authenticated user's profile")
    public ApiResponse<PatientProfileResponse> get(@AuthenticationPrincipal AppUserPrincipal principal) {
        User u = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", principal.getId()));
        return ApiResponse.ok(toResponse(u));
    }

    @PutMapping
    @Transactional
    @Operation(summary = "Update the authenticated user's profile")
    public ApiResponse<PatientProfileResponse> update(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody UpdatePatientProfileRequest req) {
        User u = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", principal.getId()));
        if (req.fullName() != null)             u.setFullName(req.fullName());
        if (req.phone() != null)                u.setPhone(nullIfBlank(req.phone()));
        if (req.dateOfBirth() != null)          u.setDateOfBirth(req.dateOfBirth());
        if (req.gender() != null)               u.setGender(nullIfBlank(req.gender()));
        if (req.addressStreet() != null)        u.setAddressStreet(nullIfBlank(req.addressStreet()));
        if (req.addressCity() != null)          u.setAddressCity(nullIfBlank(req.addressCity()));
        if (req.addressState() != null)         u.setAddressState(nullIfBlank(req.addressState()));
        if (req.addressPincode() != null)       u.setAddressPincode(nullIfBlank(req.addressPincode()));
        if (req.emergencyContactName() != null) u.setEmergencyContactName(nullIfBlank(req.emergencyContactName()));
        if (req.emergencyContactPhone() != null)u.setEmergencyContactPhone(nullIfBlank(req.emergencyContactPhone()));
        return ApiResponse.ok(toResponse(userRepository.save(u)), "Profile updated");
    }

    private static String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private static PatientProfileResponse toResponse(User u) {
        return new PatientProfileResponse(
                u.getId(), u.getEmail(), u.getFullName(), u.getPhone(),
                u.getDateOfBirth(), u.getGender(),
                u.getAddressStreet(), u.getAddressCity(), u.getAddressState(), u.getAddressPincode(),
                u.getEmergencyContactName(), u.getEmergencyContactPhone()
        );
    }
}
