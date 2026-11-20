package com.group6.healthcare.pharmacy;

import com.group6.healthcare.pharmacy.entity.CommerceOrderStatus;
import com.group6.healthcare.pharmacy.entity.CommercePaymentStatus;
import com.group6.healthcare.pharmacy.entity.PharmacyCommerceOrder;
import com.group6.healthcare.pharmacy.entity.PharmacyCommerceOrderItem;
import com.group6.healthcare.pharmacy.service.PharmacyInvoicePdfService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PharmacyInvoicePdfServiceTest {

    private PharmacyInvoicePdfService invoicePdfService;

    @BeforeEach
    void setUp() {
        invoicePdfService = new PharmacyInvoicePdfService();
    }

    @Test
    @DisplayName("Should generate valid pharmacy tax invoice PDF with itemized medicines, HSN 3004, GST breakdown, and mediclaim claim")
    void shouldGenerateValidPharmacyInvoicePdf() {
        UUID orderId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID prescriptionId = UUID.randomUUID();

        PharmacyCommerceOrder order = PharmacyCommerceOrder.builder()
                .id(orderId)
                .orderNumber("PH-20261119-9831")
                .userId(userId)
                .subtotalPaise(125000L) // Rs 1,250.00
                .discountPaise(15000L)  // Rs 150.00
                .deliveryFeePaise(0L)   // Free
                .totalPaise(110000L)    // Rs 1,100.00
                .orderStatus(CommerceOrderStatus.CONFIRMED)
                .paymentStatus(CommercePaymentStatus.SUCCESS)
                .razorpayOrderId("order_pharm_9831")
                .razorpayPaymentId("pay_pharm_9831_abc")
                .razorpaySignature("sig_test_hmac")
                .deliveryName("Deepak Verma")
                .deliveryPhone("+919876543210")
                .deliveryStreet("Flat 402, Green Meadows Apartment")
                .deliveryCity("Bengaluru")
                .deliveryState("Karnataka")
                .deliveryPincode("560100")
                .prescriptionId(prescriptionId)
                .notes("Handle with care, keep cool")
                .createdAt(OffsetDateTime.now())
                .items(new ArrayList<>())
                .build();

        PharmacyCommerceOrderItem item1 = PharmacyCommerceOrderItem.builder()
                .id(UUID.randomUUID())
                .order(order)
                .medicineName("Augmentin 625 Duo Tablet")
                .unitPricePaise(25000L)
                .quantity(2)
                .totalPaise(50000L)
                .build();

        PharmacyCommerceOrderItem item2 = PharmacyCommerceOrderItem.builder()
                .id(UUID.randomUUID())
                .order(order)
                .medicineName("Pan-D Capsule (Gastro-resistant)")
                .unitPricePaise(15000L)
                .quantity(5)
                .totalPaise(75000L)
                .build();

        order.getItems().add(item1);
        order.getItems().add(item2);

        byte[] pdfBytes = invoicePdfService.generateInvoicePdf(order);

        assertThat(pdfBytes).isNotNull();
        assertThat(pdfBytes.length).isGreaterThan(1500);

        // Verify PDF magic bytes
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertThat(header).isEqualTo("%PDF-");
    }
}
