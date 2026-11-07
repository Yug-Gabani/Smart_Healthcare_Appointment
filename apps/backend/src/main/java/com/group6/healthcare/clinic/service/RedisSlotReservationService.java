package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.SlotHoldResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Redis 2-Phase Slot Reservation Service.
 *
 * Phase 1 (Soft Hold):
 * Atomically executes 'SET slot:hold:{slotId} {patientId} NX EX 600' (10-minute hold).
 * Eliminates database row-lock contention and protects against race conditions before payment.
 *
 * Phase 2 (Hard Commit):
 * When payment verification succeeds, hard commits 'DoctorSlot.booked = true' in PostgreSQL
 * and releases the Redis lock.
 */
@Service
public class RedisSlotReservationService {

    private static final Logger log = LoggerFactory.getLogger(RedisSlotReservationService.class);
    private static final long DEFAULT_HOLD_TTL_SECONDS = 600L; // 10 minutes
    private static final String KEY_PREFIX = "slot:hold:";

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    // Resilient local fallback in case Redis cluster is offline or in mock test profile
    private record LocalHold(UUID patientId, Instant expiresAt) {}
    private final Map<UUID, LocalHold> localHoldMap = new ConcurrentHashMap<>();

    private static final String RELEASE_LUA_SCRIPT =
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
            "    return redis.call('del', KEYS[1]) " +
            "else " +
            "    return 0 " +
            "end";

    /**
     * Phase 1: Soft Hold.
     * Attempts to acquire an exclusive temporary hold for this patient on the selected slot.
     */
    public SlotHoldResponse acquireHold(UUID slotId, UUID patientId, Long requestedTtlSeconds) {
        if (slotId == null || patientId == null) {
            return new SlotHoldResponse(slotId, false, false, 0L, "Slot ID and Patient ID are required");
        }

        long ttl = (requestedTtlSeconds != null && requestedTtlSeconds > 0)
                ? requestedTtlSeconds : DEFAULT_HOLD_TTL_SECONDS;

        String key = KEY_PREFIX + slotId;
        String patientIdStr = patientId.toString();

        if (redisTemplate != null) {
            try {
                // Atomic SET key value NX EX ttl
                Boolean acquired = redisTemplate.opsForValue().setIfAbsent(key, patientIdStr, Duration.ofSeconds(ttl));

                if (Boolean.TRUE.equals(acquired)) {
                    log.info("[REDIS 2-PHASE HOLD] Patient {} acquired hold on slot {} for {}s", patientId, slotId, ttl);
                    return new SlotHoldResponse(slotId, true, true, ttl,
                            "Slot reserved exclusively for " + (ttl / 60) + " minutes while you complete payment.");
                }

                // If not acquired, check if already held by THIS same patient (extend TTL)
                String currentHolder = redisTemplate.opsForValue().get(key);
                if (patientIdStr.equals(currentHolder)) {
                    redisTemplate.expire(key, Duration.ofSeconds(ttl));
                    log.info("[REDIS 2-PHASE HOLD] Patient {} renewed existing hold on slot {} for {}s", patientId, slotId, ttl);
                    return new SlotHoldResponse(slotId, true, true, ttl,
                            "Reservation refreshed. You have " + (ttl / 60) + " minutes remaining.");
                }

                // Held by someone else
                Long remainingTtl = redisTemplate.getExpire(key);
                long secondsLeft = (remainingTtl != null && remainingTtl > 0) ? remainingTtl : 0L;
                log.warn("[REDIS 2-PHASE HOLD] Slot {} collision: Patient {} tried holding, but held by {} ({}s left)",
                        slotId, patientId, currentHolder, secondsLeft);

                return new SlotHoldResponse(slotId, false, false, secondsLeft,
                        "Slot is currently on hold by another patient for checkout. Please select another slot.");
            } catch (Exception ex) {
                log.warn("[REDIS 2-PHASE HOLD] Redis cluster unreachable: {}. Falling back to local concurrency manager.", ex.getMessage());
            }
        }

        // In-memory fallback
        Instant now = Instant.now();
        LocalHold existing = localHoldMap.get(slotId);
        if (existing == null || existing.expiresAt().isBefore(now)) {
            localHoldMap.put(slotId, new LocalHold(patientId, now.plusSeconds(ttl)));
            return new SlotHoldResponse(slotId, true, true, ttl,
                    "Slot reserved exclusively for " + (ttl / 60) + " minutes.");
        } else if (existing.patientId().equals(patientId)) {
            localHoldMap.put(slotId, new LocalHold(patientId, now.plusSeconds(ttl)));
            return new SlotHoldResponse(slotId, true, true, ttl, "Reservation refreshed.");
        } else {
            long remaining = Duration.between(now, existing.expiresAt()).toSeconds();
            return new SlotHoldResponse(slotId, false, false, Math.max(0, remaining),
                    "Slot is currently on hold by another patient.");
        }
    }

    /**
     * Checks if a slot is currently available to be booked by this patient.
     * Returns true if the slot has NO hold, OR if the hold belongs to this patient.
     */
    public boolean isSlotAvailableForPatient(UUID slotId, UUID patientId) {
        if (slotId == null) return false;
        String key = KEY_PREFIX + slotId;

        if (redisTemplate != null) {
            try {
                String currentHolder = redisTemplate.opsForValue().get(key);
                if (currentHolder == null || currentHolder.isBlank()) {
                    return true; // No active hold
                }
                return patientId != null && currentHolder.equals(patientId.toString());
            } catch (Exception ex) {
                log.warn("[REDIS CHECK] Redis error, falling back to local check: {}", ex.getMessage());
            }
        }

        LocalHold hold = localHoldMap.get(slotId);
        if (hold == null || hold.expiresAt().isBefore(Instant.now())) {
            return true;
        }
        return patientId != null && hold.patientId().equals(patientId);
    }

    /**
     * Inspects hold metadata for slot listing responses.
     */
    public HoldMetadata getHoldMetadata(UUID slotId, UUID currentPatientId) {
        if (slotId == null) return new HoldMetadata(false, false, 0L);
        String key = KEY_PREFIX + slotId;

        if (redisTemplate != null) {
            try {
                String holder = redisTemplate.opsForValue().get(key);
                if (holder != null && !holder.isBlank()) {
                    Long ttl = redisTemplate.getExpire(key);
                    long seconds = (ttl != null && ttl > 0) ? ttl : 0L;
                    boolean heldByMe = currentPatientId != null && holder.equals(currentPatientId.toString());
                    return new HoldMetadata(true, heldByMe, seconds);
                }
            } catch (Exception ex) {
                // ignore and check local
            }
        }

        LocalHold hold = localHoldMap.get(slotId);
        if (hold != null && hold.expiresAt().isAfter(Instant.now())) {
            long seconds = Duration.between(Instant.now(), hold.expiresAt()).toSeconds();
            boolean heldByMe = currentPatientId != null && hold.patientId().equals(currentPatientId);
            return new HoldMetadata(true, heldByMe, Math.max(0, seconds));
        }

        return new HoldMetadata(false, false, 0L);
    }

    public record HoldMetadata(boolean onHold, boolean heldByYou, long remainingSeconds) {}

    /**
     * Phase 2: Releases the soft hold after a hard commit or cancellation.
     * Uses atomic Lua comparison to guarantee a patient only releases their own hold.
     */
    public boolean releaseHold(UUID slotId, UUID patientId) {
        if (slotId == null || patientId == null) return false;
        String key = KEY_PREFIX + slotId;

        if (redisTemplate != null) {
            try {
                DefaultRedisScript<Long> script = new DefaultRedisScript<>(RELEASE_LUA_SCRIPT, Long.class);
                Long result = redisTemplate.execute(script, Collections.singletonList(key), patientId.toString());
                boolean released = result != null && result > 0;
                if (released) {
                    log.info("[REDIS 2-PHASE RELEASE] Released hold on slot {} for patient {}", slotId, patientId);
                }
                return released;
            } catch (Exception ex) {
                log.warn("[REDIS 2-PHASE RELEASE] Error executing Lua release: {}", ex.getMessage());
            }
        }

        LocalHold hold = localHoldMap.get(slotId);
        if (hold != null && hold.patientId().equals(patientId)) {
            localHoldMap.remove(slotId);
            return true;
        }
        return false;
    }
}

