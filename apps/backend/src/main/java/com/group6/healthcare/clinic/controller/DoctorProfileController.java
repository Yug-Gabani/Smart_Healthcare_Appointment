package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.AddSlotRequest;
import com.group6.healthcare.clinic.dto.CreateDoctorLeaveRequest;
import com.group6.healthcare.clinic.dto.DoctorLeaveResponse;
import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.ReplaceScheduleRequest;
import com.group6.healthcare.clinic.dto.SlotResponse;
import com.group6.healthcare.clinic.dto.UpdateDoctorProfileRequest;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.service.DoctorProfileService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctors/me")
@PreAuthorize("hasRole('DOCTOR')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Doctor profile", description = "Doctor's own profile, schedule, leaves and ad-hoc slots")
public class DoctorProfileController {

    private final DoctorProfileService profileService;

    public DoctorProfileController(DoctorProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    @Operation(summary = "Get the signed-in doctor's own profile (incl. verification status + schedule)")
    public ApiResponse<DoctorMeResponse> me(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(profileService.getMyProfile(principal.getId()));
    }

    @PutMapping
    @Operation(summary = "Update the signed-in doctor's profile (locked while PENDING)")
    public ApiResponse<DoctorMeResponse> update(@AuthenticationPrincipal AppUserPrincipal principal,
                                                 @Valid @RequestBody UpdateDoctorProfileRequest req) {
        return ApiResponse.ok(profileService.updateMyProfile(principal.getId(), req));
    }

    @PostMapping("/resubmit")
    @Operation(summary = "Re-submit a REJECTED profile for admin review")
    public ApiResponse<DoctorMeResponse> resubmit(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(profileService.resubmitForReview(principal.getId()));
    }

    @PutMapping("/schedule")
    @Operation(summary = "Replace the weekly template and regenerate slots for the next 14 days")
    public ApiResponse<DoctorMeResponse> replaceSchedule(@AuthenticationPrincipal AppUserPrincipal principal,
                                                         @Valid @RequestBody ReplaceScheduleRequest req) {
        return ApiResponse.ok(profileService.replaceSchedule(principal.getId(), req));
    }

    @PostMapping("/slots")
    @Operation(summary = "Add a one-off slot outside the recurring template")
    public ResponseEntity<ApiResponse<SlotResponse>> addSlot(@AuthenticationPrincipal AppUserPrincipal principal,
                                                              @Valid @RequestBody AddSlotRequest req) {
        DoctorSlot s = profileService.addAdHocSlot(principal.getId(), req.slotAt());
        return ResponseEntity.ok(ApiResponse.ok(
                new SlotResponse(s.getId(), s.getDoctorId(), s.getSlotAt(), s.isBooked())));
    }

    @DeleteMapping("/slots/{slotId}")
    @Operation(summary = "Delete an unbooked slot")
    public ResponseEntity<Void> deleteSlot(@AuthenticationPrincipal AppUserPrincipal principal,
                                            @PathVariable UUID slotId) {
        profileService.deleteSlot(principal.getId(), slotId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/leaves")
    @Operation(summary = "List all scheduled vacations/leaves for the signed-in doctor")
    public ApiResponse<List<DoctorLeaveResponse>> listLeaves(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(profileService.listLeaves(principal.getId()));
    }

    @PostMapping("/leaves")
    @Operation(summary = "Mark a vacation/leave period, suppressing slot generation and removing unbooked slots")
    public ApiResponse<DoctorLeaveResponse> addLeave(@AuthenticationPrincipal AppUserPrincipal principal,
                                                     @Valid @RequestBody CreateDoctorLeaveRequest req) {
        return ApiResponse.ok(profileService.createLeave(principal.getId(), req));
    }

    @DeleteMapping("/leaves/{leaveId}")
    @Operation(summary = "Cancel a leave and restore slots from template")
    public ResponseEntity<Void> deleteLeave(@AuthenticationPrincipal AppUserPrincipal principal,
                                            @PathVariable UUID leaveId) {
        profileService.deleteLeave(principal.getId(), leaveId);
        return ResponseEntity.noContent().build();
    }
}
