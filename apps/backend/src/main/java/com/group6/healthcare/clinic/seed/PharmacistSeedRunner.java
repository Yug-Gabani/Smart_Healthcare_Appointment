package com.group6.healthcare.clinic.seed;

import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Seeds a single pharmacist account on first boot so the pharmacy flow is testable in dev.
 * Idempotent — the user is skipped if an account with the same email exists.
 *
 * <p>Default credentials: {@value #PHARMACIST_EMAIL} / {@value #PHARMACIST_PASSWORD}.
 */
@Configuration
@Profile("dev")
public class PharmacistSeedRunner {

    private static final Logger log = LoggerFactory.getLogger(PharmacistSeedRunner.class);

    static final String PHARMACIST_EMAIL    = "pharmacist@pulsecare.local";
    static final String PHARMACIST_PASSWORD = "pharma#1234";

    @Bean
    ApplicationRunner seedPharmacist(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.existsByEmailIgnoreCase(PHARMACIST_EMAIL)) {
                log.info("Pharmacist seed: {} already exists, skipping.", PHARMACIST_EMAIL);
                return;
            }
            User p = User.builder()
                    .email(PHARMACIST_EMAIL)
                    .passwordHash(passwordEncoder.encode(PHARMACIST_PASSWORD))
                    .fullName("Pharmacy Desk")
                    .phone(null)
                    .role(Role.PHARMACIST)
                    .enabled(true)
                    .build();
            userRepository.save(p);
            log.info("Pharmacist seed: created {} (password: {}).", PHARMACIST_EMAIL, PHARMACIST_PASSWORD);
        };
    }
}
