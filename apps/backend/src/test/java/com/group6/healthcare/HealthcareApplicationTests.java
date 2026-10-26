package com.group6.healthcare;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class HealthcareApplicationTests {

    @Test
    void contextLoads() {
        // Full Spring context boots against the in-memory H2 test DB.
    }
}
