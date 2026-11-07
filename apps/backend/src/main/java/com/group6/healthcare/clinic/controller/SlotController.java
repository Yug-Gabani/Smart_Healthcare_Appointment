package com.group6.healthcare.clinic.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.clinic.dto.SlotHoldRequest;
import com.group6.healthcare.clinic.dto.SlotHoldResponse;
import com.group6.healthcare.clinic.service.RedisSlotReservationService;
import com.group6.healthcare.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/slots")
@Tag(name = "Slots & Concurrency", description = "Redis 2-Phase Slot Reservation & Concurrency Management")
@SecurityRequirement(name = "bearerAuth")
public class SlotController {

    private final RedisSlotReservationService reservationService;

    public SlotController(RedisSlotReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping("/{slotId}/hold")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Phase 1: Soft Hold — Atomically reserve a slot in Redis for 10 minutes before checkout")
    public ResponseEntity<ApiResponse<SlotHoldResponse>> acquireHold(
            @PathVariable UUID slotId,
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestBody(required = false) SlotHoldRequest req) {
        Long requestedTtl = req != null ? req.holdTtlSeconds() : 600L;
        SlotHoldResponse resp = reservationService.acquireHold(slotId, principal.getId(), requestedTtl);
        if (resp.success()) {
            return ResponseEntity.ok(ApiResponse.ok(resp, resp.message()));
        } else {
            return ResponseEntity.status(409).body(new ApiResponse<>(false, resp, resp.message(), Instant.now()));
        }
    }

    @DeleteMapping("/{slotId}/hold")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Release a soft hold if the patient cancels checkout or picks a different slot")
    public ApiResponse<Boolean> releaseHold(
            @PathVariable UUID slotId,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        boolean released = reservationService.releaseHold(slotId, principal.getId());
        return ApiResponse.ok(released, released ? "Hold released" : "No active hold to release");
    }

    @GetMapping("/{slotId}/hold-status")
    @Operation(summary = "Check the remaining reservation time or hold status of a slot")
    public ApiResponse<RedisSlotReservationService.HoldMetadata> getHoldStatus(
            @PathVariable UUID slotId,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        UUID userId = principal != null ? principal.getId() : null;
        RedisSlotReservationService.HoldMetadata meta = reservationService.getHoldMetadata(slotId, userId);
        return ApiResponse.ok(meta);
    }
}
