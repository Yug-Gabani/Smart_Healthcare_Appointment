package com.group6.healthcare.payment;

import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.payment.dto.CreatePaymentOrderRequest;
import com.group6.healthcare.payment.dto.CreatePaymentOrderResponse;
import com.group6.healthcare.payment.dto.VerifyPaymentRequest;
import com.group6.healthcare.payment.dto.VerifyPaymentResponse;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.repository.PaymentOrderRepository;
import com.group6.healthcare.payment.service.PaymentReceiptEmailService;
import com.group6.healthcare.payment.service.PaymentService;
import com.group6.healthcare.payment.service.PdfReceiptGeneratorService;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock private PaymentOrderRepository paymentOrderRepository;
    @Mock private UserRepository userRepository;
    @Mock private DoctorRepository doctorRepository;
    @Mock private PdfReceiptGeneratorService pdfGeneratorService;
    @Mock private PaymentReceiptEmailService emailService;

    private PaymentService paymentService;
    private final String testSecret = "secret1234567890abcdef";

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(
                paymentOrderRepository,
                userRepository,
                doctorRepository,
                pdfGeneratorService,
                emailService
        );
        ReflectionTestUtils.setField(paymentService, "razorpayKeySecret", testSecret);
        ReflectionTestUtils.setField(paymentService, "razorpayKeyId", "rzp_test_key");
        paymentService.setCredentials("rzp_test_key", testSecret);
    }

    @Test
    void shouldComputeHmacSha256Accurately() {
        String data = "order_OqG73hJkQW5y12|pay_OqG81kLmNp4z34";
        String computedHex = paymentService.computeHmacSha256(data, testSecret);

        assertThat(computedHex).isNotNull();
        assertThat(computedHex).hasSize(64); // 256 bits = 64 hex characters
        // Consistent output for same inputs
        assertThat(paymentService.computeHmacSha256(data, testSecret)).isEqualTo(computedHex);
    }

    @Test
    void shouldCreateOrderInCreatedStatus() {
        CreatePaymentOrderRequest req = new CreatePaymentOrderRequest(
                50000L,
                "Aarav Patel",
                "aarav@pulsecare.com",
                "+919876543210",
                UUID.randomUUID(),
                "Today 02:00 PM"
        );

        when(paymentOrderRepository.save(any(PaymentOrder.class))).thenAnswer(invocation -> {
            PaymentOrder po = invocation.getArgument(0);
            po.setId(UUID.randomUUID());
            return po;
        });

        CreatePaymentOrderResponse resp = paymentService.createOrder(req, UUID.randomUUID());

        assertThat(resp).isNotNull();
        assertThat(resp.razorpayOrderId()).isNotNull();
        assertThat(resp.amountPaise()).isEqualTo(50000L);
        assertThat(resp.currency()).isEqualTo("INR");
        assertThat(resp.status()).isEqualTo("CREATED");
        verify(paymentOrderRepository, times(1)).save(any(PaymentOrder.class));
    }

    @Test
    void shouldVerifyPaymentWithValidHmac() {
        String orderId = "order_real123";
        String paymentId = "pay_real456";
        String validSig = paymentService.computeHmacSha256(orderId + "|" + paymentId, testSecret);

        PaymentOrder po = PaymentOrder.builder()
                .id(UUID.randomUUID())
                .patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID())
                .razorpayOrderId(orderId)
                .amountPaise(50000L)
                .currency("INR")
                .receipt("rcpt_123")
                .status(PaymentOrder.Status.CREATED)
                .build();

        when(paymentOrderRepository.findByRazorpayOrderIdForUpdate(orderId)).thenReturn(Optional.of(po));
        when(paymentOrderRepository.save(any(PaymentOrder.class))).thenReturn(po);

        VerifyPaymentResponse resp = paymentService.verifyPayment(
                new VerifyPaymentRequest(orderId, paymentId, validSig)
        );

        assertThat(resp.status()).isEqualTo("PAID");
        assertThat(resp.razorpayOrderId()).isEqualTo(orderId);
        assertThat(resp.razorpayPaymentId()).isEqualTo(paymentId);
        assertThat(po.getStatus()).isEqualTo(PaymentOrder.Status.PAID);
    }

    @Test
    void shouldFailVerificationOnSignatureMismatch() {
        String orderId = "order_real123";
        String paymentId = "pay_real456";
        String bogusSig = "bad_signature_hash_000000000000000000000000000000000000000000000";

        PaymentOrder po = PaymentOrder.builder()
                .id(UUID.randomUUID())
                .patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID())
                .razorpayOrderId(orderId)
                .amountPaise(50000L)
                .currency("INR")
                .receipt("rcpt_123")
                .status(PaymentOrder.Status.CREATED)
                .build();

        when(paymentOrderRepository.findByRazorpayOrderIdForUpdate(orderId)).thenReturn(Optional.of(po));

        assertThatThrownBy(() -> paymentService.verifyPayment(new VerifyPaymentRequest(orderId, paymentId, bogusSig)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("signature mismatch");

        assertThat(po.getStatus()).isEqualTo(PaymentOrder.Status.FAILED);
        verify(paymentOrderRepository).save(po);
    }

    @Test
    void shouldRejectBypassSignatureOnLiveOrder() {
        paymentService.setCredentials("rzp_live_realProductionKey", testSecret);
        String orderId = "order_realLive999";
        String paymentId = "pay_live888";

        PaymentOrder po = PaymentOrder.builder()
                .id(UUID.randomUUID())
                .patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID())
                .razorpayOrderId(orderId)
                .amountPaise(50000L)
                .currency("INR")
                .receipt("rcpt_999")
                .status(PaymentOrder.Status.CREATED)
                .build();

        when(paymentOrderRepository.findByRazorpayOrderIdForUpdate(orderId)).thenReturn(Optional.of(po));

        assertThatThrownBy(() -> paymentService.verifyPayment(new VerifyPaymentRequest(orderId, paymentId, "sandbox_signature")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid signature for live Razorpay order");

        assertThat(po.getStatus()).isEqualTo(PaymentOrder.Status.FAILED);
        verify(paymentOrderRepository).save(po);
    }

    @Test
    void shouldDetectAndRejectPaymentIdReplayAttack() {
        String orderIdA = "order_realLiveA";
        String paymentIdRedeemed = "pay_stolen_payment_id";
        String validSig = paymentService.computeHmacSha256(orderIdA + "|" + paymentIdRedeemed, testSecret);

        PaymentOrder poA = PaymentOrder.builder()
                .id(UUID.randomUUID())
                .patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID())
                .razorpayOrderId(orderIdA)
                .amountPaise(50000L)
                .currency("INR")
                .receipt("rcpt_A")
                .status(PaymentOrder.Status.CREATED)
                .build();

        PaymentOrder existingOtherOrder = PaymentOrder.builder()
                .id(UUID.randomUUID())
                .patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID())
                .razorpayOrderId("order_anotherDifferentOrder")
                .razorpayPaymentId(paymentIdRedeemed)
                .amountPaise(50000L)
                .currency("INR")
                .receipt("rcpt_other")
                .status(PaymentOrder.Status.PAID)
                .build();

        when(paymentOrderRepository.findByRazorpayOrderIdForUpdate(orderIdA)).thenReturn(Optional.of(poA));
        when(paymentOrderRepository.findByRazorpayPaymentId(paymentIdRedeemed)).thenReturn(Optional.of(existingOtherOrder));

        assertThatThrownBy(() -> paymentService.verifyPayment(new VerifyPaymentRequest(orderIdA, paymentIdRedeemed, validSig)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already redeemed for another order");

        assertThat(poA.getStatus()).isEqualTo(PaymentOrder.Status.FAILED);
        verify(paymentOrderRepository).save(poA);
    }

    @Test
    void shouldBeIdempotentIfAlreadyPaid() {
        String orderId = "order_already_paid";
        PaymentOrder po = PaymentOrder.builder()
                .id(UUID.randomUUID())
                .patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID())
                .razorpayOrderId(orderId)
                .razorpayPaymentId("pay_prev_456")
                .amountPaise(50000L)
                .currency("INR")
                .receipt("rcpt_123")
                .status(PaymentOrder.Status.PAID)
                .build();

        when(paymentOrderRepository.findByRazorpayOrderIdForUpdate(orderId)).thenReturn(Optional.of(po));

        VerifyPaymentResponse resp = paymentService.verifyPayment(
                new VerifyPaymentRequest(orderId, "pay_new_attempt", "any_sig")
        );

        assertThat(resp.status()).isEqualTo("PAID");
        assertThat(resp.razorpayOrderId()).isEqualTo(orderId);
        assertThat(resp.razorpayPaymentId()).isEqualTo("pay_prev_456");
        // No new save needed
        verify(paymentOrderRepository, never()).save(any(PaymentOrder.class));
    }
}

