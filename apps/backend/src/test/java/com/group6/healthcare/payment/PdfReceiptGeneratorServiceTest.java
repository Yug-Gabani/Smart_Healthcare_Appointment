package com.group6.healthcare.payment;

import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import com.group6.healthcare.payment.service.PdfReceiptGeneratorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PdfReceiptGeneratorServiceTest {

    private PdfReceiptGeneratorService pdfGeneratorService;

    @BeforeEach
    void setUp() {
        pdfGeneratorService = new PdfReceiptGeneratorService();
    }

    @Test
    void shouldGenerateValidPdfDocument() {
        PaymentSuccessEvent event = new PaymentSuccessEvent(
                UUID.randomUUID(),
                "patient.test@pulsecare.com",
                "Rahul Sharma",
                "Dr. Ananya Roy (Cardiology)",
                50000L,
                "INR",
                "pay_test123456789",
                "order_test987654321",
                Instant.now(),
                "+919876543210",
                "Tomorrow 10:30 AM"
        );

        byte[] pdfBytes = pdfGeneratorService.generateReceiptPdf(event);

        assertThat(pdfBytes).isNotNull();
        assertThat(pdfBytes.length).isGreaterThan(1000);

        // Verify PDF Magic Bytes (%PDF-)
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertThat(header).isEqualTo("%PDF-");
    }

    @Test
    void shouldHandleNullOrDefaultFieldsGracefully() {
        PaymentSuccessEvent event = new PaymentSuccessEvent(
                null,
                null,
                null,
                null,
                75000L,
                "INR",
                "pay_null_test",
                "order_null_test",
                Instant.now(),
                null,
                null
        );

        byte[] pdfBytes = pdfGeneratorService.generateReceiptPdf(event);

        assertThat(pdfBytes).isNotNull();
        assertThat(pdfBytes.length).isGreaterThan(1000);
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertThat(header).isEqualTo("%PDF-");
    }
}

