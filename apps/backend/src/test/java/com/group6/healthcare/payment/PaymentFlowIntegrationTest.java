package com.group6.healthcare.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.payment.dto.CreatePaymentOrderRequest;
import com.group6.healthcare.payment.dto.VerifyPaymentRequest;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import com.group6.healthcare.payment.repository.PaymentOrderRepository;
import com.group6.healthcare.payment.service.PaymentService;
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
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaymentFlowIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PaymentOrderRepository paymentOrderRepository;
    @Autowired private PaymentService paymentService;

    @MockBean
    private KafkaTemplate<String, PaymentSuccessEvent> kafkaTemplate;

    @BeforeEach
    void cleanUp() {
        paymentOrderRepository.deleteAll();
        when(kafkaTemplate.send(any(), any(), any())).thenReturn(new CompletableFuture<>());
    }

    @Test
    void shouldCompleteFullPaymentLifecycleEndToEnd() throws Exception {
        // 1. Create Payment Order
        CreatePaymentOrderRequest createReq = new CreatePaymentOrderRequest(
                50000L,
                "Rohan Verma",
                "rohan.verma@example.com",
                "+919876543210",
                UUID.randomUUID(),
                "Today 02:00 PM"
        );

        MvcResult createResult = mockMvc.perform(post("/api/v1/payments/create-order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.razorpayOrderId").isNotEmpty())
                .andExpect(jsonPath("$.data.amountPaise").value(50000))
                .andExpect(jsonPath("$.data.status").value("CREATED"))
                .andReturn();

        String createJson = createResult.getResponse().getContentAsString();
        String orderId = objectMapper.readTree(createJson).path("data").path("razorpayOrderId").asText();
        assertThat(orderId).isNotBlank();

        // 2. Verify Payment with HMAC signature
        String paymentId = "pay_test_" + UUID.randomUUID().toString().substring(0, 8);
        String signature = paymentService.computeHmacSha256(orderId + "|" + paymentId, paymentService.getRazorpayKeySecret());
        VerifyPaymentRequest verifyReq = new VerifyPaymentRequest(orderId, paymentId, signature);

        mockMvc.perform(post("/api/v1/payments/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.razorpayOrderId").value(orderId))
                .andExpect(jsonPath("$.data.razorpayPaymentId").value(paymentId));

        // Verify Kafka event published
        verify(kafkaTemplate).send(eq("payment-receipt-topic"), eq(orderId), any(PaymentSuccessEvent.class));

        // 3. Idempotent re-verification
        mockMvc.perform(post("/api/v1/payments/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"));

        // 4. Download / Stream Medical PDF Tax Invoice
        MvcResult pdfResult = mockMvc.perform(get("/api/v1/payments/receipt/" + orderId + "/pdf"))
                .andExpect(status().isOk())
                .andReturn();

        byte[] pdfBytes = pdfResult.getResponse().getContentAsByteArray();
        assertThat(pdfBytes).isNotEmpty();
        assertThat(new String(pdfBytes, 0, 5)).isEqualTo("%PDF-");

        // 5. Query Orders API
        mockMvc.perform(get("/api/v1/payments/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].razorpayOrderId").value(orderId))
                .andExpect(jsonPath("$.data[0].status").value("PAID"));
    }
}
