package com.group6.healthcare.payment;

import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import com.group6.healthcare.payment.service.WhatsAppNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppNotificationServiceTest {

    private WhatsAppNotificationService whatsAppService;

    @BeforeEach
    void setUp() {
        whatsAppService = new WhatsAppNotificationService();
    }

    @Test
    void shouldNormalizeVariousPhoneFormats() {
        assertThat(whatsAppService.normalizePhoneNumber("9876543210")).isEqualTo("+919876543210");
        assertThat(whatsAppService.normalizePhoneNumber("+919876543210")).isEqualTo("+919876543210");
        assertThat(whatsAppService.normalizePhoneNumber("+17372508034")).isEqualTo("+17372508034");
        assertThat(whatsAppService.normalizePhoneNumber("+91 (987) 654-3210")).isEqualTo("+919876543210");
        assertThat(whatsAppService.normalizePhoneNumber(null)).isEqualTo("+919876543210");
    }

    @Test
    void shouldReturnFalseWhenDisabled() {
        ReflectionTestUtils.setField(whatsAppService, "whatsappEnabled", false);

        PaymentSuccessEvent event = new PaymentSuccessEvent(
                UUID.randomUUID(),
                "test@pulsecare.com",
                "John Doe",
                "Dr. Smith",
                50000L,
                "INR",
                "pay_test",
                "order_test",
                Instant.now(),
                "+919876543210",
                "Today 02:00 PM"
        );

        boolean result = whatsAppService.sendPaymentReceipt(event);
        assertThat(result).isFalse();
    }
}

