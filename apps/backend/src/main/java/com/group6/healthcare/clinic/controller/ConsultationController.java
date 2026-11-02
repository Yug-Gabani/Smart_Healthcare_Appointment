package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.ConsultationEndRequest;
import com.group6.healthcare.clinic.dto.ConsultationSessionResponse;
import com.group6.healthcare.clinic.dto.ConsultationSignalMessage;
import com.group6.healthcare.clinic.service.ConsultationService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/consultations")
@Tag(name = "Video Consultations", description = "Live WebRTC video consultations and post-visit clinical summaries")
@SecurityRequirement(name = "bearerAuth")
public class ConsultationController {

    private final ConsultationService consultationService;

    public ConsultationController(ConsultationService consultationService) {
        this.consultationService = consultationService;
    }

    @GetMapping("/appointments/{appointmentId}")
    @PreAuthorize("hasRole('PATIENT') or hasRole('DOCTOR')")
    @Operation(summary = "Get or initialize video consultation room session, activation status, and post-visit summary")
    public ApiResponse<ConsultationSessionResponse> getSession(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID appointmentId) {
        return ApiResponse.ok(consultationService.getOrCreateSession(appointmentId, principal.getId()));
    }

    @PostMapping("/appointments/{appointmentId}/start")
    @PreAuthorize("hasRole('PATIENT') or hasRole('DOCTOR')")
    @Operation(summary = "Start or activate the video consultation session")
    public ApiResponse<ConsultationSessionResponse> startSession(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID appointmentId) {
        return ApiResponse.ok(consultationService.startConsultation(appointmentId, principal.getId()), "Consultation started");
    }

    @PostMapping("/appointments/{appointmentId}/end")
    @PreAuthorize("hasRole('PATIENT') or hasRole('DOCTOR')")
    @Operation(summary = "Conclude the video consultation, process transcript, and generate clinical post-visit summary")
    public ApiResponse<ConsultationSessionResponse> endSession(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID appointmentId,
            @RequestBody(required = false) ConsultationEndRequest req) {
        return ApiResponse.ok(
                consultationService.endConsultation(appointmentId, principal.getId(), req),
                "Consultation completed and clinical summary generated"
        );
    }

    @PostMapping("/appointments/{appointmentId}/signal")
    @PreAuthorize("hasRole('PATIENT') or hasRole('DOCTOR')")
    @Operation(summary = "Post a WebRTC signaling message (SDP offer/answer, ICE candidate, or in-call chat)")
    public ApiResponse<String> postSignal(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID appointmentId,
            @RequestBody ConsultationSignalMessage message) {
        // Enforce the senderId to match the authenticated user
        ConsultationSignalMessage secureMessage = new ConsultationSignalMessage(
                message.type(),
                principal.getId(),
                principal.getRole(),
                message.payload(),
                System.currentTimeMillis()
        );
        consultationService.pushSignal(appointmentId, secureMessage);
        return ApiResponse.ok("Signal dispatched");
    }

    @GetMapping("/appointments/{appointmentId}/signals")
    @PreAuthorize("hasRole('PATIENT') or hasRole('DOCTOR')")
    @Operation(summary = "Poll WebRTC signaling messages from the consultation peer")
    public ApiResponse<List<ConsultationSignalMessage>> pollSignals(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID appointmentId,
            @RequestParam(name = "since", defaultValue = "0") long since) {
        return ApiResponse.ok(consultationService.pollSignals(appointmentId, principal.getId(), since));
    }
}
