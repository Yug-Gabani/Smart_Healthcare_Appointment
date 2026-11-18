package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.AddSlotRequest;
import com.group6.healthcare.clinic.dto.CreateDoctorLeaveRequest;
import com.group6.healthcare.clinic.dto.DoctorLeaveDto;
import com.group6.healthcare.clinic.dto.DoctorMeResponse;
import com.group6.healthcare.clinic.dto.DoctorSlotDetailResponse;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctors/me")
@PreAuthorize("hasRole('DOCTOR')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Doctor profile", description = "Doctor's own profile, recurring schedule, vacations/leaves and slot inventory")
public class DoctorProfileController {

    private final DoctorProfileService profileService;

    public DoctorProfileController(DoctorProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    @Operation(summary = "Get the signed-in doctor's own profile (incl. verification status, schedule + leaves)")
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
    @Operation(summary = "Replace the weekly recurring schedule and automatically generate slots for the next 14 days")
    public ApiResponse<DoctorMeResponse> replaceSchedule(@AuthenticationPrincipal AppUserPrincipal principal,
                                                         @Valid @RequestBody ReplaceScheduleRequest req) {
        return ApiResponse.ok(profileService.replaceSchedule(principal.getId(), req));
    }

    // ---------- Vacation & Leave Calendar (Issue #82) ----------

    @GetMapping("/leaves")
    @Operation(summary = "List all leaves and vacation blocks for the signed-in doctor")
    public ApiResponse<List<DoctorLeaveDto>> getLeaves(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(profileService.getLeaves(principal.getId()));
    }

    @PostMapping("/leaves")
    @Operation(summary = "Mark a leave/vacation date or range — suppresses slot creation and marks unbooked slots unavailable")
    public ResponseEntity<ApiResponse<DoctorLeaveDto>> addLeave(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody CreateDoctorLeaveRequest req) {
        DoctorLeaveDto created = profileService.addLeave(principal.getId(), req);
        return ResponseEntity.ok(ApiResponse.ok(created, "Leave marked successfully"));
    }

    @DeleteMapping("/leaves/{leaveId}")
    @Operation(summary = "Delete/cancel a marked leave — restores regular slot generation")
    public ResponseEntity<Void> deleteLeave(@AuthenticationPrincipal AppUserPrincipal principal,
                                            @PathVariable UUID leaveId) {
        profileService.deleteLeave(principal.getId(), leaveId);
        return ResponseEntity.noContent().build();
    }

    // ---------- Slots & Forward Inventory ----------

    @GetMapping("/slots-inventory")
    @Operation(summary = "Get the doctor's forward slot inventory (default 14 days) with booking and leave context")
    public ApiResponse<List<DoctorSlotDetailResponse>> getSlotsInventory(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam(name = "days", defaultValue = "14") int days) {
        return ApiResponse.ok(profileService.getMySlots(principal.getId(), days));
    }

    @PutMapping("/slots/{slotId}/toggle")
    @Operation(summary = "Toggle availability of an unbooked slot (Available <-> Unavailable)")
    public ApiResponse<DoctorSlotDetailResponse> toggleSlotAvailability(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID slotId) {
        return ApiResponse.ok(profileService.toggleSlotAvailability(principal.getId(), slotId));
    }

    @PostMapping("/slots")
    @Operation(summary = "Add a one-off slot outside the recurring template")
    public ResponseEntity<ApiResponse<SlotResponse>> addSlot(@AuthenticationPrincipal AppUserPrincipal principal,
                                                              @Valid @RequestBody AddSlotRequest req) {
        DoctorSlot s = profileService.addAdHocSlot(principal.getId(), req.slotAt());
        return ResponseEntity.ok(ApiResponse.ok(
                new SlotResponse(s.getId(), s.getDoctorId(), s.getSlotAt(), s.isBooked(), s.isAvailable(), false, false, 0L)));
    }

    @DeleteMapping("/slots/{slotId}")
    @Operation(summary = "Delete an unbooked slot")
    public ResponseEntity<Void> deleteSlot(@AuthenticationPrincipal AppUserPrincipal principal,
                                            @PathVariable UUID slotId) {
        profileService.deleteSlot(principal.getId(), slotId);
        return ResponseEntity.noContent().build();
    }
}
