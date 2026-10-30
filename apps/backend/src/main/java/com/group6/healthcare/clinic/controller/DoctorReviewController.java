package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.CreateReviewRequest;
import com.group6.healthcare.clinic.dto.DoctorReviewResponse;
import com.group6.healthcare.clinic.service.DoctorReviewService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Reviews & Ratings", description = "Post-appointment feedback, doctor star ratings, and verified landing reviews")
public class DoctorReviewController {

    private final DoctorReviewService reviewService;

    public DoctorReviewController(DoctorReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping("/appointments/{id}/review")
    @PreAuthorize("hasRole('PATIENT')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Submit a 1-5 star review and feedback for a completed appointment")
    public ResponseEntity<ApiResponse<DoctorReviewResponse>> submitReview(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody CreateReviewRequest req) {

        DoctorReviewResponse response = reviewService.createReview(principal.getId(), id, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response, "Review submitted successfully"));
    }

    @GetMapping("/appointments/{id}/review")
    @Operation(summary = "Fetch the review submitted for an appointment (if any)")
    public ApiResponse<DoctorReviewResponse> getAppointmentReview(@PathVariable UUID id) {
        return ApiResponse.ok(reviewService.getReviewForAppointment(id));
    }

    @GetMapping("/reviews/doctors/{doctorId}")
    @Operation(summary = "List all patient reviews for a doctor")
    public ApiResponse<List<DoctorReviewResponse>> getDoctorReviews(@PathVariable UUID doctorId) {
        return ApiResponse.ok(reviewService.getReviewsForDoctor(doctorId));
    }

    @GetMapping("/reviews/landing")
    @Operation(summary = "Fetch featured high-rated reviews for the public landing page")
    public ApiResponse<List<DoctorReviewResponse>> getLandingReviews(
            @RequestParam(name = "limit", defaultValue = "6") int limit) {
        return ApiResponse.ok(reviewService.getFeaturedReviewsForLanding(limit));
    }
}
