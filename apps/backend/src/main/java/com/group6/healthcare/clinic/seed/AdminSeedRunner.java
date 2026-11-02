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
 * Seeds a single admin account on first boot so doctor verification can be exercised end-to-end
 * in the dev profile. Idempotent — the user is skipped if an account with the same email exists.
 *
 * <p>Default credentials: {@value #ADMIN_EMAIL} / {@value #ADMIN_PASSWORD}.
 */
@Configuration
@Profile("dev")
public class AdminSeedRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminSeedRunner.class);

    static final String ADMIN_EMAIL    = "admin@pulsecare.local";
    static final String ADMIN_PASSWORD = "admin#1234";

    @Bean
    ApplicationRunner seedAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.existsByEmailIgnoreCase(ADMIN_EMAIL)) {
                log.info("Admin seed: {} already exists, skipping.", ADMIN_EMAIL);
                return;
            }
            User admin = User.builder()
                    .email(ADMIN_EMAIL)
                    .passwordHash(passwordEncoder.encode(ADMIN_PASSWORD))
                    .fullName("Platform Admin")
                    .phone(null)
                    .role(Role.ADMIN)
                    .enabled(true)
                    .build();
            userRepository.save(admin);
            log.info("Admin seed: created {} (password: {}).", ADMIN_EMAIL, ADMIN_PASSWORD);
        };
    }
}
