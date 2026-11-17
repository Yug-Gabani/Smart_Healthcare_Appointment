package com.group6.healthcare.auth.service;

import com.group6.healthcare.auth.entity.PasswordResetToken;
import com.group6.healthcare.auth.repository.PasswordResetTokenRepository;
import com.group6.healthcare.auth.repository.RefreshTokenRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;

/**
 * Self-service password reset.
 *
 * <p>Design notes:</p>
 * <ul>
 *   <li>The plaintext reset token is sent to the user's email. Only its SHA-256 hash
 *       is stored, so a leaked database row cannot be replayed.</li>
 *   <li>Requesting a reset for an unknown email returns success without sending mail —
 *       this prevents account-enumeration via the reset endpoint.</li>
 *   <li>Successful confirmation invalidates every outstanding refresh token for the
 *       user, forcing other sessions to re-authenticate with the new password.</li>
 *   <li>Tokens are single-use and expire after {@code app.security.password-reset.
 *       validity-minutes} (default 60).</li>
 * </ul>
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthEmailService authEmailService;
    private final SecureRandom random = new SecureRandom();

    @Value("${app.security.password-reset.validity-minutes:60}")
    private int validityMinutes;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetTokenRepository tokenRepository,
                                RefreshTokenRepository refreshTokenRepository,
                                PasswordEncoder passwordEncoder,
                                AuthEmailService authEmailService) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authEmailService = authEmailService;
    }

    /**
     * Start a password-reset flow. Deliberately returns success for unknown emails to
     * prevent account enumeration; the caller only ever sees "if that email exists we
     * sent a link."
     */
    @Transactional
    public void requestReset(String email) {
        var userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            log.info("Password reset requested for unknown email (returning silent success)");
            return;
        }
        User user = userOpt.get();
        if (!user.isEnabled() || user.isDeleted()) {
            log.info("Password reset requested for deactivated account id={} (returning silent success)",
                    user.getId());
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        tokenRepository.invalidateActiveTokensForUser(user.getId(), now);

        String rawToken = newToken();
        PasswordResetToken row = PasswordResetToken.builder()
                .userId(user.getId())
                .tokenHash(sha256(rawToken))
                .expiresAt(now.plusMinutes(validityMinutes))
                .build();
        tokenRepository.save(row);

        authEmailService.sendPasswordResetEmail(user, rawToken, validityMinutes);
    }

    /**
     * Complete a password reset. The token is validated, marked used, the user's
     * password is replaced, and all refresh tokens are revoked so existing sessions
     * cannot keep using stale credentials.
     */
    @Transactional
    public void confirmReset(String rawToken, String newPassword) {
        String hash = sha256(rawToken);
        PasswordResetToken row = tokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BusinessRuleException("Invalid or expired reset link"));
        if (!row.isUsable()) {
            throw new BusinessRuleException("Invalid or expired reset link");
        }

        User user = userRepository.findById(row.getUserId())
                .orElseThrow(() -> new BusinessRuleException("Invalid or expired reset link"));
        if (!user.isEnabled() || user.isDeleted()) {
            throw new BusinessRuleException("Account is deactivated");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        row.setUsedAt(OffsetDateTime.now());
        tokenRepository.save(row);

        refreshTokenRepository.revokeAllForUser(user.getId());
        log.info("Password reset completed for user id={}", user.getId());
    }

    // ---------- helpers ----------

    private String newToken() {
        // 32 random bytes => 64-char hex. Enough entropy that guessing is infeasible
        // and short enough that the full token still fits comfortably in a URL.
        byte[] bytes = new byte[32];
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
