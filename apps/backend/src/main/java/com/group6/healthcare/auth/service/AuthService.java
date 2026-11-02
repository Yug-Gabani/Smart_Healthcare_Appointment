package com.group6.healthcare.auth.service;

import com.group6.healthcare.auth.dto.LoginRequest;
import com.group6.healthcare.auth.dto.RegisterRequest;
import com.group6.healthcare.auth.dto.TokenResponse;
import com.group6.healthcare.auth.entity.RefreshToken;
import com.group6.healthcare.auth.repository.RefreshTokenRepository;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ConflictException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final DoctorRepository doctorRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final SecureRandom random = new SecureRandom();

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       DoctorRepository doctorRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.doctorRepository = doctorRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public TokenResponse register(RegisterRequest req) {
        if (userRepository.existsByEmailIgnoreCase(req.email())) {
            throw new ConflictException("Email already registered: " + req.email());
        }
        // Admin and pharmacist self-signup is not allowed from the public endpoint.
        if (req.role() == Role.ADMIN) {
            throw new BusinessRuleException("Admin accounts cannot self-register");
        }
        if (req.role() == Role.DOCTOR) {
            if (isBlank(req.specialty())) {
                throw new BusinessRuleException("Specialty is required for doctor sign-up");
            }
            if (isBlank(req.registrationNumber())) {
                throw new BusinessRuleException("Medical registration number is required for doctor sign-up");
            }
        }

        User user = User.builder()
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .fullName(req.fullName())
                .phone(req.phone())
                .role(req.role())
                .enabled(true)
                .build();
        user = userRepository.save(user);

        if (req.role() == Role.DOCTOR) {
            Doctor d = Doctor.builder()
                    .userId(user.getId())
                    .fullName(req.fullName())
                    .specialty(req.specialty().trim())
                    .hospital(req.hospitalName() == null ? "" : req.hospitalName().trim())
                    .hospitalId(req.hospitalId())
                    .registrationNumber(req.registrationNumber().trim())
                    .status(DoctorStatus.PENDING)
                    .submittedAt(OffsetDateTime.now())
                    .rating(new BigDecimal("0.00"))
                    .reviewCount(0)
                    .build();
            doctorRepository.save(d);
        }

        return issueTokens(user);
    }

    @Transactional
    public TokenResponse login(LoginRequest req) {
        User user = userRepository.findByEmailIgnoreCase(req.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        if (!user.isEnabled() || user.isDeleted()) {
            throw new BadCredentialsException("Account is deactivated or deleted");
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }
        return issueTokens(user);
    }

    @Transactional
    public TokenResponse refresh(String rawRefreshToken) {
        String hash = sha256(rawRefreshToken);
        RefreshToken rt = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));
        if (!rt.isActive()) {
            throw new BadCredentialsException("Refresh token expired or revoked");
        }
        User user = userRepository.findById(rt.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", rt.getUserId()));

        rt.setRevoked(true);
        refreshTokenRepository.save(rt);
        return issueTokens(user);
    }

    @Transactional
    public void logout(UUID userId) {
        refreshTokenRepository.revokeAllForUser(userId);
    }

    // ---------- helpers ----------

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private TokenResponse issueTokens(User user) {
        String access = jwtService.generateAccessToken(user);
        String refresh = newOpaqueRefreshToken();

        RefreshToken rt = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(sha256(refresh))
                .expiresAt(OffsetDateTime.now().plusDays(jwtService.refreshTokenValidityDays()))
                .revoked(false)
                .build();
        refreshTokenRepository.save(rt);

        return new TokenResponse(
                access,
                refresh,
                "Bearer",
                jwtService.accessTokenValiditySeconds(),
                new TokenResponse.UserSummary(
                        user.getId(), user.getEmail(), user.getFullName(), user.getRole())
        );
    }

    private String newOpaqueRefreshToken() {
        byte[] bytes = new byte[48];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
