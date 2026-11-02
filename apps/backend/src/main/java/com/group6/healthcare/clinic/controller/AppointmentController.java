package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.AppointmentResponse;
import com.group6.healthcare.clinic.dto.BookAppointmentRequest;
import com.group6.healthcare.clinic.dto.PatchAppointmentRequest;
import com.group6.healthcare.clinic.service.AppointmentService;
import com.group6.healthcare.clinic.service.AppointmentService.DoctorQueueScope;
import org.springframework.web.bind.annotation.RequestParam;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/appointments")
@Tag(name = "Appointments", description = "Patient bookings + queue (FR-04, FR-09)")
@SecurityRequirement(name = "bearerAuth")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @PostMapping
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Book an appointment on an open slot. Slot is pessimistically locked.")
    public ResponseEntity<ApiResponse<AppointmentResponse>> book(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody BookAppointmentRequest req) {
        AppointmentResponse resp = appointmentService.book(principal.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(resp, "Appointment booked"));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "List the authenticated patient's appointments, most recent first")
    public ApiResponse<List<AppointmentResponse>> myAppointments(
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ApiResponse.ok(appointmentService.listForPatient(principal.getId()));
    }

    @GetMapping("/queue")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "List this doctor's appointments. scope=active (default) | past | all")
    public ApiResponse<List<AppointmentResponse>> doctorQueue(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam(name = "scope", defaultValue = "active") String scope) {
        DoctorQueueScope s;
        try {
            s = DoctorQueueScope.valueOf(scope.toUpperCase());
        } catch (IllegalArgumentException ex) {
            s = DoctorQueueScope.ACTIVE;
        }
        return ApiResponse.ok(appointmentService.listForDoctor(principal.getId(), s));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Fetch a single appointment (patients see their own, doctors see theirs)")
    public ApiResponse<AppointmentResponse> get(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id) {
        UUID patientScope = "PATIENT".equals(principal.getRole()) ? principal.getId() : null;
        return ApiResponse.ok(appointmentService.get(id, patientScope));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Cancel one of the patient's own appointments and free the slot")
    public ApiResponse<AppointmentResponse> cancel(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id) {
        return ApiResponse.ok(appointmentService.cancel(principal.getId(), id), "Appointment cancelled");
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('DOCTOR')")
    @Operation(summary = "Doctor acts on an appointment: ACCEPT, START, COMPLETE, NO_SHOW, OVERRIDE_URGENCY")
    public ApiResponse<AppointmentResponse> doctorAction(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody PatchAppointmentRequest req) {
        return ApiResponse.ok(
                appointmentService.doctorAction(principal.getId(), id, req),
                "Appointment updated"
        );
    }
}
