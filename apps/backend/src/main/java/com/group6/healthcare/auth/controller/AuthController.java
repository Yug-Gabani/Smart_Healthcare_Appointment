package com.group6.healthcare.auth.controller;

import com.group6.healthcare.auth.dto.LoginRequest;
import com.group6.healthcare.auth.dto.MeResponse;
import com.group6.healthcare.auth.dto.RefreshRequest;
import com.group6.healthcare.auth.dto.RegisterRequest;
import com.group6.healthcare.auth.dto.TokenResponse;
import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.auth.service.AuthService;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Registration, login, refresh, logout")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    public AuthController(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @PostMapping("/register")
    @Operation(summary = "Create a new account (FR-01)")
    public ResponseEntity<ApiResponse<TokenResponse>> register(@Valid @RequestBody RegisterRequest req) {
        TokenResponse tokens = authService.register(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(tokens, "Account created"));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate and receive JWT + refresh token (FR-01)")
    public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok(authService.login(req));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Exchange a refresh token for a new access token")
    public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshRequest req) {
        return ApiResponse.ok(authService.refresh(req.refreshToken()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke all refresh tokens for the current user (FR-01)")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal AppUserPrincipal principal) {
        authService.logout(principal.getId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    @Operation(summary = "Return the authenticated user's profile")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<MeResponse> me(@AuthenticationPrincipal AppUserPrincipal principal) {
        var user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", principal.getId()));
        return ApiResponse.ok(new MeResponse(
                user.getId(), user.getEmail(), user.getFullName(), user.getPhone(), user.getRole()));
    }
}
