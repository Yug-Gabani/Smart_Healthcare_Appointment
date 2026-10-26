package com.group6.healthcare.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security.jwt")
public record JwtProperties(
        String secret,
        long accessTokenValidityMinutes,
        long refreshTokenValidityDays,
        String issuer
) {
    public JwtProperties {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "app.security.jwt.secret must be set (>=32 chars) via env JWT_SECRET");
        }
        if (secret.getBytes().length < 32) {
            throw new IllegalStateException(
                    "app.security.jwt.secret must be at least 32 bytes for HS256");
        }
        if (accessTokenValidityMinutes <= 0) accessTokenValidityMinutes = 15;
        if (refreshTokenValidityDays <= 0) refreshTokenValidityDays = 7;
        if (issuer == null || issuer.isBlank()) issuer = "smart-healthcare";
    }
}
