package com.group6.healthcare.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.auth.dto.LoginRequest;
import com.group6.healthcare.auth.dto.RefreshRequest;
import com.group6.healthcare.auth.dto.RegisterRequest;
import com.group6.healthcare.auth.repository.RefreshTokenRepository;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired UserRepository userRepository;

    @BeforeEach
    void cleanTables() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    private String json(Object body) throws Exception {
        return om.writeValueAsString(body);
    }

    private JsonNode registerAlice() throws Exception {
        var req = new RegisterRequest(
                "alice@example.com", "Secret12345", "Alice Patient", "+10000000000", Role.PATIENT);
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").exists())
                .andExpect(jsonPath("$.data.refreshToken").exists())
                .andExpect(jsonPath("$.data.user.email").value("alice@example.com"))
                .andReturn();
        return om.readTree(result.getResponse().getContentAsString()).get("data");
    }

    @Test
    void protectedEndpointRejectsAnonymous() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void publicPingReachable() throws Exception {
        mvc.perform(get("/api/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("up"));
    }

    @Test
    void registerThenLoginThenMe() throws Exception {
        JsonNode registered = registerAlice();
        String access = registered.get("accessToken").asText();

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("alice@example.com"))
                .andExpect(jsonPath("$.data.role").value("PATIENT"));

        var login = new LoginRequest("alice@example.com", "Secret12345");
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").exists());
    }

    @Test
    void duplicateEmailReturnsConflict() throws Exception {
        registerAlice();
        var req = new RegisterRequest(
                "ALICE@EXAMPLE.COM", "Another12345", "Alice Dupe", null, Role.DOCTOR);
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(req)))
                .andExpect(status().isConflict());
    }

    @Test
    void loginWithWrongPasswordIs401() throws Exception {
        registerAlice();
        var login = new LoginRequest("alice@example.com", "WrongPassword1");
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(login)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRotatesTokens() throws Exception {
        JsonNode registered = registerAlice();
        String refresh = registered.get("refreshToken").asText();

        MvcResult rotated = mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RefreshRequest(refresh))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").exists())
                .andExpect(jsonPath("$.data.refreshToken").exists())
                .andReturn();

        String newRefresh = om.readTree(rotated.getResponse().getContentAsString())
                .get("data").get("refreshToken").asText();
        assertThat(newRefresh).isNotEqualTo(refresh);

        // The old refresh token must now be rejected.
        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RefreshRequest(refresh))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesRefreshTokens() throws Exception {
        JsonNode registered = registerAlice();
        String access = registered.get("accessToken").asText();
        String refresh = registered.get("refreshToken").asText();

        mvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + access))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RefreshRequest(refresh))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registerValidationFails() throws Exception {
        String bad = """
                {"email":"not-an-email","password":"short","fullName":"","role":"PATIENT"}""";
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bad))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }
}
