package com.group6.healthcare.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.auth.dto.LoginRequest;
import com.group6.healthcare.auth.dto.RegisterRequest;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Destructive & Negative Defect Exploration Suite for Auth.
 * These tests are specifically designed against OWASP, business logic, and security standards
 * to uncover real defects and missing validations where the current system FAILS to enforce
 * expected defensive behavior.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Disabled("Defect discovery suite: demonstrates known open defects documented in tests/reports/AUTH_TEST_REPORT.md. Not run in CI.")
public class AuthDefectsAndEdgeCasesTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper om;
    @Autowired private UserRepository userRepository;
    @Autowired private DoctorRepository doctorRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setup() {
        doctorRepository.deleteAll();
        userRepository.deleteAll();
    }

    private String json(Object obj) throws Exception {
        return om.writeValueAsString(obj);
    }

    /**
     * DEFECT 1: Privilege Escalation - Self-Registration as PHARMACIST
     *
     * In AuthService.java line 58:
     * "// Admin and pharmacist self-signup is not allowed from the public endpoint."
     * But the developer only wrote `if (req.role() == Role.ADMIN)`.
     * EXPECTED: 400 Bad Request
     * ACTUAL: 201 Created (Security bug: anyone can register as Pharmacist)
     */
    @Test
    @DisplayName("DEFECT-01: Public self-registration with Role.PHARMACIST should be blocked with 400 Bad Request")
    void test_defect_01_pharmacist_self_registration_should_be_blocked() throws Exception {
        var req = new RegisterRequest(
                "pharmacist.rogue@example.com", "Password#123", "Rogue Pharmacist", "+919876543210",
                Role.PHARMACIST, null, null, null, null);

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isBadRequest()); // CURRENTLY FAILS: Returns 201 Created!
    }

    /**
     * DEFECT 2: Privilege Escalation - Self-Registration as STAFF
     *
     * EXPECTED: 400 Bad Request
     * ACTUAL: 201 Created (Staff can self-register from public endpoint)
     */
    @Test
    @DisplayName("DEFECT-02: Public self-registration with Role.STAFF should be blocked with 400 Bad Request")
    void test_defect_02_staff_self_registration_should_be_blocked() throws Exception {
        var req = new RegisterRequest(
                "staff.rogue@example.com", "Password#123", "Rogue Staff", "+919876543210",
                Role.STAFF, null, null, null, null);

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isBadRequest()); // CURRENTLY FAILS: Returns 201 Created!
    }

    /**
     * DEFECT 3: Weak / Trivial Password Acceptance
     *
     * Healthcare compliance requires minimum complexity (digits, upper/lower, symbols).
     * Currently RegisterRequest only has @Size(min=8) with no complexity pattern.
     * EXPECTED: 400 Bad Request
     * ACTUAL: 201 Created (Accepts '12345678' and 'password')
     */
    @Test
    @DisplayName("DEFECT-03: Trivial weak password '12345678' should be rejected with 400 Bad Request")
    void test_defect_03_trivial_weak_password_should_be_rejected() throws Exception {
        var req = new RegisterRequest(
                "weakpass@example.com", "12345678", "Weak User", "+919876543210",
                Role.PATIENT, null, null, null, null);

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isBadRequest()); // CURRENTLY FAILS: Returns 201 Created!
    }

    /**
     * DEFECT 4: Garbage / Non-Numeric Phone Number Accepted
     *
     * RegisterRequest only has @Size(max=50) on phone without regex or @Pattern.
     * EXPECTED: 400 Bad Request
     * ACTUAL: 201 Created (Saves 'NOT_A_PHONE_NUMBER_$$$#@' directly in DB)
     */
    @Test
    @DisplayName("DEFECT-04: Non-numeric garbage phone number should be rejected with 400 Bad Request")
    void test_defect_04_garbage_phone_number_should_be_rejected() throws Exception {
        var req = new RegisterRequest(
                "garbagephone@example.com", "SecurePass#123", "Phone Tester", "NOT_A_PHONE_NUMBER_$$$#@",
                Role.PATIENT, null, null, null, null);

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isBadRequest()); // CURRENTLY FAILS: Returns 201 Created!
    }

    /**
     * DEFECT 5: Lack of Rate Limiting / Brute-Force Lockout
     *
     * Rapid repeated failed login attempts should trigger HTTP 429 Too Many Requests
     * or account lockout after 5 failures.
     * EXPECTED: 429 Too Many Requests after consecutive failed logins
     * ACTUAL: 401 Unauthorized continuously without throttling
     */
    @Test
    @DisplayName("DEFECT-05: 10 rapid failed login attempts should trigger 429 Too Many Requests")
    void test_defect_05_brute_force_logins_should_be_rate_limited() throws Exception {
        userRepository.save(User.builder()
                .email("victim@example.com")
                .passwordHash(passwordEncoder.encode("RealPassword#123"))
                .fullName("Victim User")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        // Perform 9 failed attempts
        for (int i = 0; i < 9; i++) {
            mvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(new LoginRequest("victim@example.com", "WrongPassword" + i))));
        }

        // 10th attempt should be blocked with 429 Too Many Requests or account locked
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new LoginRequest("victim@example.com", "WrongPassword10"))))
                .andExpect(status().isTooManyRequests()); // CURRENTLY FAILS: Returns 401 Unauthorized without rate limit!
    }
}
