package com.group6.healthcare.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.payment.controller.PaymentTestbenchController.SimulatePaymentInput;
import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaymentTestbenchControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean
    private KafkaTemplate<String, PaymentSuccessEvent> kafkaTemplate;

    @BeforeEach
    void setupMock() {
        when(kafkaTemplate.send(any(), any(), any())).thenReturn(new CompletableFuture<>());
    }

    @Test
    void shouldSimulatePaymentSuccessfully() throws Exception {
        SimulatePaymentInput input = new SimulatePaymentInput(
                50000L,
                "Aarav Patel",
                "aarav@example.com",
                "+919876543210",
                "Dr. Ananya Roy",
                "Today 05:00 PM"
        );

        mockMvc.perform(post("/api/v1/payments/testbench/simulate-payment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.razorpayOrderId").isNotEmpty())
                .andExpect(jsonPath("$.data.razorpayPaymentId").isNotEmpty())
                .andExpect(jsonPath("$.data.hmacVerificationStatus").value("VERIFIED (HMAC-SHA256 Matched)"))
                .andExpect(jsonPath("$.data.pdfDownloadUrl").isNotEmpty())
                .andExpect(jsonPath("$.data.pdfByteCount").isNumber());
    }

    @Test
    void shouldPerformAllApisCheckSuccessfully() throws Exception {
        mockMvc.perform(get("/api/v1/payments/testbench/all-apis-check"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.database").exists())
                .andExpect(jsonPath("$.data.razorpayGateway").exists())
                .andExpect(jsonPath("$.data.kafkaEventStreaming").exists())
                .andExpect(jsonPath("$.data.openPdfInvoiceGenerator").exists())
                .andExpect(jsonPath("$.data.gmailSmtpMailer").exists())
                .andExpect(jsonPath("$.data.whatsAppDualEngine").exists())
                .andExpect(jsonPath("$.data.apiCatalog").isArray());
    }

    @Test
    void shouldRenderTestbenchHtmlUi() throws Exception {
        mockMvc.perform(get("/api/v1/payments/testbench/ui"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("PulseCare Testbench")));
    }
}

