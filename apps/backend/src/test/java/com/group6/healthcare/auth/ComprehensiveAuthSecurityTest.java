package com.group6.healthcare.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.auth.dto.ConfirmPasswordResetRequest;
import com.group6.healthcare.auth.dto.LoginRequest;
import com.group6.healthcare.auth.dto.RefreshRequest;
import com.group6.healthcare.auth.dto.RegisterRequest;
import com.group6.healthcare.auth.dto.RequestPasswordResetRequest;
import com.group6.healthcare.auth.entity.PasswordResetToken;
import com.group6.healthcare.auth.entity.RefreshToken;
import com.group6.healthcare.auth.repository.PasswordResetTokenRepository;
import com.group6.healthcare.auth.repository.RefreshTokenRepository;
import com.group6.healthcare.auth.service.JwtService;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ComprehensiveAuthSecurityTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper om;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private DoctorRepository doctorRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    @BeforeEach
    void setupDatabase() {
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        doctorRepository.deleteAll();
        userRepository.deleteAll();
    }

    private String json(Object obj) throws Exception {
        return om.writeValueAsString(obj);
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // =========================================================================
    // GROUP 1: REGISTRATION & SIGN-UP VALIDATION (TC-AUTH-01 to 08)
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("TC-AUTH-01: Valid patient registration succeeds with 201 Created")
    void test_01_patient_registration_success() throws Exception {
        var req = new RegisterRequest(
                "patient.test@example.com", "Password@123", "John Patient", "+919876543210",
                Role.PATIENT, null, null, null, null);

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andExpect(jsonPath("$.data.user.email").value("patient.test@example.com"))
                .andExpect(jsonPath("$.data.user.role").value("PATIENT"));

        assertThat(userRepository.existsByEmailIgnoreCase("patient.test@example.com")).isTrue();
    }

    @Test
    @Order(2)
    @DisplayName("TC-AUTH-02: Valid doctor registration creates doctor in PENDING status")
    void test_02_doctor_registration_success() throws Exception {
        var req = new RegisterRequest(
                "dr.smith@example.com", "DoctorPass#123", "Dr. John Smith", "+919876543211",
                Role.DOCTOR, "Cardiology", "City General Hospital", null, "MCI-45892");

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.user.role").value("DOCTOR"));

        User user = userRepository.findByEmailIgnoreCase("dr.smith@example.com").orElseThrow();
        Doctor doc = doctorRepository.findAll().stream()
                .filter(d -> d.getUserId().equals(user.getId()))
                .findFirst().orElseThrow();

        assertThat(doc.getStatus()).isEqualTo(DoctorStatus.PENDING);
        assertThat(doc.getSpecialty()).isEqualTo("Cardiology");
        assertThat(doc.getRegistrationNumber()).isEqualTo("MCI-45892");
    }

    @Test
    @Order(3)
    @DisplayName("TC-AUTH-03: Privilege escalation prevention - Admin self-registration blocked")
    void test_03_admin_self_registration_prevention() throws Exception {
        var req = new RegisterRequest(
                "hacker.admin@example.com", "HackerPass@123", "Fake Admin", null,
                Role.ADMIN, null, null, null, null);

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Admin accounts cannot self-register"));
    }

    @Test
    @Order(4)
    @DisplayName("TC-AUTH-04: Doctor registration missing specialty is rejected with 400")
    void test_04_doctor_missing_specialty_rejected() throws Exception {
        var req = new RegisterRequest(
                "dr.incomplete@example.com", "DoctorPass#123", "Dr. Incomplete", null,
                Role.DOCTOR, "   ", "City Hospital", null, "MCI-99999");

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Specialty is required for doctor sign-up"));
    }

    @Test
    @Order(5)
    @DisplayName("TC-AUTH-05: Doctor registration missing medical registration number is rejected")
    void test_05_doctor_missing_reg_number_rejected() throws Exception {
        var req = new RegisterRequest(
                "dr.nolicense@example.com", "DoctorPass#123", "Dr. No License", null,
                Role.DOCTOR, "Pediatrics", "City Hospital", null, "");

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Medical registration number is required for doctor sign-up"));
    }

    @Test
    @Order(6)
    @DisplayName("TC-AUTH-06: Duplicate email registration returns 409 Conflict (case-insensitive)")
    void test_06_duplicate_email_conflict() throws Exception {
        var req1 = new RegisterRequest(
                "unique.patient@example.com", "Password@123", "Patient One", null,
                Role.PATIENT, null, null, null, null);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(req1)))
                .andExpect(status().isCreated());

        var req2 = new RegisterRequest(
                "UNIQUE.PATIENT@EXAMPLE.COM", "AnotherPass@123", "Patient Dupe", null,
                Role.PATIENT, null, null, null, null);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(req2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Email already registered: UNIQUE.PATIENT@EXAMPLE.COM"));
    }

    @Test
    @Order(7)
    @DisplayName("TC-AUTH-07: Malformed email syntax rejected by Bean Validation")
    void test_07_invalid_email_format() throws Exception {
        var req = new RegisterRequest(
                "not-a-valid-email-string", "Password@123", "Test User", null,
                Role.PATIENT, null, null, null, null);

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    @Test
    @Order(8)
    @DisplayName("TC-AUTH-08: Password length shorter than 8 chars rejected")
    void test_08_short_password_rejected() throws Exception {
        var req = new RegisterRequest(
                "shortpass@example.com", "12345", "Short Pass", null,
                Role.PATIENT, null, null, null, null);

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    // =========================================================================
    // GROUP 2: LOGIN & CREDENTIAL VERIFICATION (TC-AUTH-09 to 14)
    // =========================================================================

    @Test
    @Order(9)
    @DisplayName("TC-AUTH-09: Login with valid credentials returns Bearer access token")
    void test_09_login_success() throws Exception {
        userRepository.save(User.builder()
                .email("login.user@example.com")
                .passwordHash(passwordEncoder.encode("ValidPass#123"))
                .fullName("Login User")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        var login = new LoginRequest("login.user@example.com", "ValidPass#123");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andExpect(jsonPath("$.data.user.email").value("login.user@example.com"));
    }

    @Test
    @Order(10)
    @DisplayName("TC-AUTH-10: Login with wrong password returns 401 Unauthorized")
    void test_10_login_wrong_password() throws Exception {
        userRepository.save(User.builder()
                .email("login.user@example.com")
                .passwordHash(passwordEncoder.encode("ValidPass#123"))
                .fullName("Login User")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        var login = new LoginRequest("login.user@example.com", "WrongPassword999");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json(login)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(11)
    @DisplayName("TC-AUTH-11: Login with non-existent user returns 401 Unauthorized")
    void test_11_login_unknown_email() throws Exception {
        var login = new LoginRequest("ghost@example.com", "SomePassword#123");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json(login)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(12)
    @DisplayName("TC-AUTH-12: SQL Injection attack payload in login handled safely without 500 error")
    void test_12_sql_injection_attempt_in_login() throws Exception {
        // Case A: Raw SQL injection payload fails @Email validation -> 400 Bad Request
        var rawSql = new LoginRequest("' OR '1'='1", "Password#123");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json(rawSql)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("email"));

        // Case B: SQL injection formatted as email reaches JPA parameterized query -> 401 Unauthorized
        var emailSql = new LoginRequest("admin'--@example.com", "Password#123");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json(emailSql)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(13)
    @DisplayName("TC-AUTH-13: Deactivated account (enabled=false) blocked from login with 401")
    void test_13_deactivated_account_login_blocked() throws Exception {
        userRepository.save(User.builder()
                .email("deactivated@example.com")
                .passwordHash(passwordEncoder.encode("ValidPass#123"))
                .fullName("Disabled User")
                .role(Role.PATIENT)
                .enabled(false)
                .build());

        var login = new LoginRequest("deactivated@example.com", "ValidPass#123");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json(login)))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // GROUP 3: TOKEN LIFECYCLE & TAMPERING ATTACKS (TC-AUTH-14 to 18)
    // =========================================================================

    @Test
    @Order(14)
    @DisplayName("TC-AUTH-14: Protected /api/auth/me succeeds with valid Bearer JWT")
    void test_14_me_endpoint_with_valid_jwt() throws Exception {
        User user = userRepository.save(User.builder()
                .email("me.user@example.com")
                .passwordHash(passwordEncoder.encode("Pass#123"))
                .fullName("Me User")
                .role(Role.PATIENT)
                .enabled(true)
                .build());
        String token = jwtService.generateAccessToken(user);

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("me.user@example.com"))
                .andExpect(jsonPath("$.data.fullName").value("Me User"))
                .andExpect(jsonPath("$.data.role").value("PATIENT"));
    }

    @Test
    @Order(15)
    @DisplayName("TC-AUTH-15: Protected /api/auth/me rejects anonymous request with 401")
    void test_15_me_endpoint_anonymous_rejected() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(16)
    @DisplayName("TC-AUTH-16: Tampered JWT signature is rejected with 401 Unauthorized")
    void test_16_tampered_jwt_signature_rejected() throws Exception {
        User user = userRepository.save(User.builder()
                .email("tamper@example.com")
                .passwordHash(passwordEncoder.encode("Pass#123"))
                .fullName("Tamper Test")
                .role(Role.PATIENT)
                .enabled(true)
                .build());
        String validToken = jwtService.generateAccessToken(user);

        // Tamper with the payload part of the token (between the two dots)
        String[] parts = validToken.split("\\.");
        String tamperedToken = parts[0] + "." + parts[1] + "X." + parts[2];

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tamperedToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(17)
    @DisplayName("TC-AUTH-17: Malformed / garbage Bearer token rejected with 401")
    void test_17_malformed_bearer_token_rejected() throws Exception {
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer garbage.invalid.token"))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // GROUP 4: REFRESH TOKEN ROTATION & REPLAY ATTACK (TC-AUTH-18 to 21)
    // =========================================================================

    @Test
    @Order(18)
    @DisplayName("TC-AUTH-18: Refresh token rotation issues new pair and revokes old refresh token")
    void test_18_refresh_token_rotation() throws Exception {
        var req = new RegisterRequest(
                "rotator@example.com", "Password#123", "Rotator", null,
                Role.PATIENT, null, null, null, null);
        MvcResult reg = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(req)))
                .andReturn();
        String oldRefresh = om.readTree(reg.getResponse().getContentAsString()).get("data").get("refreshToken").asText();

        // 1. Rotate
        MvcResult rotated = mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RefreshRequest(oldRefresh))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andReturn();

        String newRefresh = om.readTree(rotated.getResponse().getContentAsString()).get("data").get("refreshToken").asText();
        assertThat(newRefresh).isNotEqualTo(oldRefresh);

        // 2. Replaying the old refresh token must be rejected with 401
        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RefreshRequest(oldRefresh))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(19)
    @DisplayName("TC-AUTH-19: Logout revokes all active refresh tokens for the user")
    void test_19_logout_revokes_sessions() throws Exception {
        var req = new RegisterRequest(
                "logout.user@example.com", "Password#123", "Logout User", null,
                Role.PATIENT, null, null, null, null);
        MvcResult reg = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(req)))
                .andReturn();
        JsonNode data = om.readTree(reg.getResponse().getContentAsString()).get("data");
        String access = data.get("accessToken").asText();
        String refresh = data.get("refreshToken").asText();

        // Logout
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + access))
                .andExpect(status().isNoContent());

        // Refresh with that token must now fail
        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RefreshRequest(refresh))))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // GROUP 5: SELF-SERVICE PASSWORD RESET & ANTI-ENUMERATION (TC-AUTH-20 to 24)
    // =========================================================================

    @Test
    @Order(20)
    @DisplayName("TC-AUTH-20: Password reset request for unknown email returns 200 (anti-enumeration)")
    void test_20_password_reset_request_anti_enumeration() throws Exception {
        var req = new RequestPasswordResetRequest("nonexistent.email@example.com");

        mvc.perform(post("/api/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If that email is registered, a reset link has been sent."));

        assertThat(passwordResetTokenRepository.count()).isEqualTo(0);
    }

    @Test
    @Order(21)
    @DisplayName("TC-AUTH-21: Password reset flow updates password and revokes old credentials")
    void test_21_password_reset_flow_success() throws Exception {
        User user = userRepository.save(User.builder()
                .email("reset.flow@example.com")
                .passwordHash(passwordEncoder.encode("OldPassword#123"))
                .fullName("Reset Flow User")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        String rawToken = "my_secret_reset_token_hex_string_12345678";
        passwordResetTokenRepository.save(PasswordResetToken.builder()
                .userId(user.getId())
                .tokenHash(sha256(rawToken))
                .expiresAt(OffsetDateTime.now().plusHours(1))
                .build());

        // Confirm reset with new password
        var confirmReq = new ConfirmPasswordResetRequest(rawToken, "NewSecurePassword#456");
        mvc.perform(post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(confirmReq)))
                .andExpect(status().isOk());

        // Login with old password fails
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new LoginRequest("reset.flow@example.com", "OldPassword#123"))))
                .andExpect(status().isUnauthorized());

        // Login with new password succeeds
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new LoginRequest("reset.flow@example.com", "NewSecurePassword#456"))))
                .andExpect(status().isOk());
    }

    @Test
    @Order(22)
    @DisplayName("TC-AUTH-22: Password reset confirm with invalid token returns 400 Bad Request")
    void test_22_password_reset_invalid_token_fails() throws Exception {
        var confirmReq = new ConfirmPasswordResetRequest("fake_token_not_in_db", "NewSecurePassword#456");
        mvc.perform(post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(confirmReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid or expired reset link"));
    }

    @Test
    @Order(23)
    @DisplayName("TC-AUTH-23: Password reset confirm with expired token returns 400 Bad Request")
    void test_23_password_reset_expired_token_fails() throws Exception {
        User user = userRepository.save(User.builder()
                .email("expired.token@example.com")
                .passwordHash(passwordEncoder.encode("OldPassword#123"))
                .fullName("Expired Token User")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        String rawToken = "expired_reset_token_hex_12345";
        passwordResetTokenRepository.save(PasswordResetToken.builder()
                .userId(user.getId())
                .tokenHash(sha256(rawToken))
                .expiresAt(OffsetDateTime.now().minusMinutes(5)) // Expired in the past
                .build());

        var confirmReq = new ConfirmPasswordResetRequest(rawToken, "NewSecurePassword#456");
        mvc.perform(post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(confirmReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid or expired reset link"));
    }

    @Test
    @Order(24)
    @DisplayName("TC-AUTH-24: Replaying used password reset token returns 400 Bad Request")
    void test_24_password_reset_replay_attack_rejected() throws Exception {
        User user = userRepository.save(User.builder()
                .email("replay.token@example.com")
                .passwordHash(passwordEncoder.encode("OldPassword#123"))
                .fullName("Replay User")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        String rawToken = "single_use_reset_token_98765";
        passwordResetTokenRepository.save(PasswordResetToken.builder()
                .userId(user.getId())
                .tokenHash(sha256(rawToken))
                .expiresAt(OffsetDateTime.now().plusHours(1))
                .usedAt(OffsetDateTime.now().minusMinutes(1)) // Already marked used
                .build());

        var confirmReq = new ConfirmPasswordResetRequest(rawToken, "NewSecurePassword#456");
        mvc.perform(post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(confirmReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid or expired reset link"));
    }

    // =========================================================================
    // GROUP 6: ROLE-BASED ACCESS CONTROL (RBAC) & PRIVILEGE BOUNDARIES (TC-AUTH-25 to 28)
    // =========================================================================

    @Test
    @Order(25)
    @DisplayName("TC-AUTH-25: RBAC - Patient JWT attempting to access Admin Overview is 403 Forbidden")
    void test_25_rbac_patient_forbidden_from_admin() throws Exception {
        User patient = userRepository.save(User.builder()
                .email("patient.rbac@example.com")
                .passwordHash(passwordEncoder.encode("Pass#123"))
                .fullName("Patient RBAC")
                .role(Role.PATIENT)
                .enabled(true)
                .build());
        String patientToken = jwtService.generateAccessToken(patient);

        mvc.perform(get("/api/v1/admin/overview")
                        .header("Authorization", "Bearer " + patientToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(26)
    @DisplayName("TC-AUTH-26: RBAC - Patient JWT attempting to access Doctor Profile is 403 Forbidden")
    void test_26_rbac_patient_forbidden_from_doctor_profile() throws Exception {
        User patient = userRepository.save(User.builder()
                .email("patient.doc@example.com")
                .passwordHash(passwordEncoder.encode("Pass#123"))
                .fullName("Patient Doc Test")
                .role(Role.PATIENT)
                .enabled(true)
                .build());
        String patientToken = jwtService.generateAccessToken(patient);

        mvc.perform(get("/api/v1/doctors/me")
                        .header("Authorization", "Bearer " + patientToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(27)
    @DisplayName("TC-AUTH-27: RBAC - Doctor JWT attempting to access Admin Doctor Verification is 403 Forbidden")
    void test_27_rbac_doctor_forbidden_from_admin() throws Exception {
        User doctor = userRepository.save(User.builder()
                .email("doctor.rbac@example.com")
                .passwordHash(passwordEncoder.encode("Pass#123"))
                .fullName("Dr. RBAC")
                .role(Role.DOCTOR)
                .enabled(true)
                .build());
        String doctorToken = jwtService.generateAccessToken(doctor);

        mvc.perform(get("/api/v1/admin/doctors")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(28)
    @DisplayName("TC-AUTH-28: RBAC - Admin JWT is successfully authorized for Admin Overview (200 OK)")
    void test_28_rbac_admin_authorized() throws Exception {
        User admin = userRepository.save(User.builder()
                .email("admin.rbac@example.com")
                .passwordHash(passwordEncoder.encode("AdminPass#123"))
                .fullName("Super Admin")
                .role(Role.ADMIN)
                .enabled(true)
                .build());
        String adminToken = jwtService.generateAccessToken(admin);

        mvc.perform(get("/api/v1/admin/overview")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").exists());
    }
}
