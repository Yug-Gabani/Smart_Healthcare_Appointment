package com.group6.healthcare.auth.service;

import com.group6.healthcare.config.JwtProperties;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties(
                "test-secret-test-secret-test-secret-32chars-min",
                15L, 7L, "smart-healthcare-test");
        jwtService = new JwtService(props);
    }

    private User sampleUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .email("alice@example.com")
                .passwordHash("x")
                .fullName("Alice")
                .role(Role.PATIENT)
                .enabled(true)
                .build();
    }

    @Test
    void generatedTokenRoundTrips() {
        User user = sampleUser();
        String token = jwtService.generateAccessToken(user);

        Claims claims = jwtService.parseAndValidate(token);

        assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
        assertThat(claims.get("email", String.class)).isEqualTo(user.getEmail());
        assertThat(claims.get("role", String.class)).isEqualTo("PATIENT");
        assertThat(jwtService.extractUserId(claims)).isEqualTo(user.getId());
        assertThat(jwtService.extractRole(claims)).isEqualTo("PATIENT");
    }

    @Test
    void tokenWithWrongSignatureIsRejected() {
        User user = sampleUser();
        String good = jwtService.generateAccessToken(user);

        // Tamper with the signature portion (3rd segment of a JWS).
        String[] parts = good.split("\\.");
        String tampered = parts[0] + "." + parts[1] + "." + "deadbeef";

        assertThatThrownBy(() -> jwtService.parseAndValidate(tampered))
                .isInstanceOf(JwtService.InvalidTokenException.class);
    }

    @Test
    void tokenSignedByAnotherSecretIsRejected() {
        User user = sampleUser();
        JwtService other = new JwtService(new JwtProperties(
                "other-secret-other-secret-other-secret-32chars",
                15L, 7L, "smart-healthcare-test"));
        String fromOther = other.generateAccessToken(user);

        assertThatThrownBy(() -> jwtService.parseAndValidate(fromOther))
                .isInstanceOf(JwtService.InvalidTokenException.class);
    }

    @Test
    void propertiesRejectShortSecret() {
        assertThatThrownBy(() ->
                new JwtProperties("short", 15L, 7L, "iss"))
                .isInstanceOf(IllegalStateException.class);
    }
}
