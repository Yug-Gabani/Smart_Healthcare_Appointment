package com.group6.healthcare.auth.repository;

import com.group6.healthcare.auth.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /**
     * Invalidate every outstanding (unused, unexpired) reset token for a user. Called when
     * a new reset is requested (so an older link emailed to a stolen inbox cannot be used)
     * and when a reset completes successfully.
     */
    @Modifying
    @Query("UPDATE PasswordResetToken p SET p.usedAt = :now " +
           "WHERE p.userId = :userId AND p.usedAt IS NULL AND p.expiresAt > :now")
    int invalidateActiveTokensForUser(@Param("userId") UUID userId,
                                      @Param("now") OffsetDateTime now);
}
