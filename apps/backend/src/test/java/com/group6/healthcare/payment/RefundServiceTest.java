package com.group6.healthcare.payment;

import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.payment.dto.CancelAndRefundRequest;
import com.group6.healthcare.payment.dto.CancelAndRefundResponse;
import com.group6.healthcare.payment.dto.RefundCalculationResult;
import com.group6.healthcare.payment.dto.RefundPreviewResponse;
import com.group6.healthcare.payment.dto.RefundTier;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.entity.PaymentRefund;
import com.group6.healthcare.payment.repository.PaymentOrderRepository;
import com.group6.healthcare.payment.repository.PaymentRefundRepository;
import com.group6.healthcare.payment.service.NotificationAuditService;
import com.group6.healthcare.payment.service.PaymentService;
import com.group6.healthcare.payment.service.RefundService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefundServiceTest {

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private DoctorSlotRepository doctorSlotRepository;

    @Mock
    private DoctorRepository doctorRepository;

    @Mock
    private PaymentOrderRepository paymentOrderRepository;

    @Mock
    private PaymentRefundRepository paymentRefundRepository;

    @Mock
    private NotificationAuditService auditService;

    @Mock
    private PaymentService paymentService;

    private RefundService refundService;

    private UUID appointmentId;
    private UUID patientId;
    private UUID doctorId;
    private UUID slotId;
    private Appointment appointment;
    private DoctorSlot doctorSlot;
    private PaymentOrder paymentOrder;

    @BeforeEach
    void setUp() {
        refundService = new RefundService(
                appointmentRepository,
                doctorSlotRepository,
                doctorRepository,
                paymentOrderRepository,
                paymentRefundRepository,
                auditService,
                paymentService
        );

        appointmentId = UUID.randomUUID();
        patientId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
        slotId = UUID.randomUUID();

        doctorSlot = DoctorSlot.builder()
                .id(slotId)
                .doctorId(doctorId)
                .slotAt(OffsetDateTime.now().plusDays(2))
                .booked(true)
                .build();

        appointment = Appointment.builder()
                .id(appointmentId)
                .patientId(patientId)
                .doctorId(doctorId)
                .slotId(slotId)
                .status(AppointmentStatus.CONFIRMED)
                .consultationType(ConsultationType.VIDEO)
                .urgency(Urgency.ROUTINE)
                .build();

        paymentOrder = PaymentOrder.builder()
                .id(UUID.randomUUID())
                .appointmentId(appointmentId)
                .patientId(patientId)
                .doctorId(doctorId)
                .razorpayOrderId("order_test_12345")
                .razorpayPaymentId("pay_sim_test_12345")
                .amountPaise(50000L) // ₹500
                .currency("INR")
                .receipt("rcpt_test_01")
                .status(PaymentOrder.Status.PAID)
                .build();
    }

    @Test
    @DisplayName("Tier 1 (>24 hours): Cancelling 1 day or more before yields 100% full refund")
    void testTier1_FullRefund_MoreThan24Hours() {
        // 36 hours before appointment
        RefundCalculationResult result = refundService.calculateRefund(doctorSlot, paymentOrder, 36.0);

        assertThat(result.tier()).isEqualTo(RefundTier.FULL_100);
        assertThat(result.refundPercentage()).isEqualTo(100);
        assertThat(result.refundAmountPaise()).isEqualTo(50000L); // Full ₹500
        assertThat(result.retentionAmountPaise()).isEqualTo(0L);
        assertThat(result.eligibleForRefund()).isTrue();
        assertThat(result.policyMessage()).contains("100% full refund of ₹500.00");
    }

    @Test
    @DisplayName("Tier 2 (12 to 24 hours): Cancelling 18 hours before yields 50% partial refund")
    void testTier2_PartialRefund_12to24Hours() {
        // 18 hours before appointment
        RefundCalculationResult result = refundService.calculateRefund(doctorSlot, paymentOrder, 18.0);

        assertThat(result.tier()).isEqualTo(RefundTier.PARTIAL_50);
        assertThat(result.refundPercentage()).isEqualTo(50);
        assertThat(result.refundAmountPaise()).isEqualTo(25000L); // ₹250
        assertThat(result.retentionAmountPaise()).isEqualTo(25000L); // ₹250
        assertThat(result.eligibleForRefund()).isTrue();
        assertThat(result.policyMessage()).contains("50% refund of ₹250.00");
    }

    @Test
    @DisplayName("Tier 3 (6 to 12 hours): Cancelling 8 hours before yields 25% partial refund")
    void testTier3_PartialRefund_6to12Hours() {
        // 8 hours before appointment
        RefundCalculationResult result = refundService.calculateRefund(doctorSlot, paymentOrder, 8.0);

        assertThat(result.tier()).isEqualTo(RefundTier.PARTIAL_25);
        assertThat(result.refundPercentage()).isEqualTo(25);
        assertThat(result.refundAmountPaise()).isEqualTo(12500L); // ₹125
        assertThat(result.retentionAmountPaise()).isEqualTo(37500L); // ₹375
        assertThat(result.eligibleForRefund()).isTrue();
        assertThat(result.policyMessage()).contains("25% refund of ₹125.00");
    }

    @Test
    @DisplayName("Tier 4 (<6 hours): Cancelling 2 hours before yields 0% non-refundable")
    void testTier4_NoRefund_Under6Hours() {
        // 2 hours before appointment
        RefundCalculationResult result = refundService.calculateRefund(doctorSlot, paymentOrder, 2.0);

        assertThat(result.tier()).isEqualTo(RefundTier.NO_REFUND_0);
        assertThat(result.refundPercentage()).isEqualTo(0);
        assertThat(result.refundAmountPaise()).isEqualTo(0L);
        assertThat(result.retentionAmountPaise()).isEqualTo(50000L); // Retains full ₹500
        assertThat(result.eligibleForRefund()).isFalse();
        assertThat(result.policyMessage()).contains("non-refundable (₹0 refund)");
    }

    @Test
    @DisplayName("Free consultation booking (₹0) calculates complimentary policy")
    void testFreeConsultationBooking() {
        PaymentOrder freeOrder = PaymentOrder.builder()
                .amountPaise(0L)
                .build();

        RefundCalculationResult result = refundService.calculateRefund(doctorSlot, freeOrder, 30.0);

        assertThat(result.tier()).isEqualTo(RefundTier.FREE_CONSULTATION);
        assertThat(result.refundPercentage()).isEqualTo(0);
        assertThat(result.refundAmountPaise()).isEqualTo(0L);
        assertThat(result.eligibleForRefund()).isFalse();
        assertThat(result.policyMessage()).contains("Complimentary consultation");
    }

    @Test
    @DisplayName("Preview calculation returns complete response with doctor and slot details")
    void testGetRefundPreview() {
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(appointment));
        when(doctorSlotRepository.findById(slotId)).thenReturn(Optional.of(doctorSlot));
        when(paymentOrderRepository.findFirstByAppointmentIdOrderByCreatedAtDesc(appointmentId))
                .thenReturn(Optional.of(paymentOrder));

        RefundPreviewResponse preview = refundService.getRefundPreview(appointmentId, patientId, 20.0);

        assertThat(preview.appointmentId()).isEqualTo(appointmentId);
        assertThat(preview.refundPercentage()).isEqualTo(50);
        assertThat(preview.refundAmountPaise()).isEqualTo(25000L);
        assertThat(preview.canCancel()).isTrue();
        assertThat(preview.simulatedNotice()).contains("Simulating cancellation with 20.0 hours");
    }

    @Test
    @DisplayName("Full cancellation and refund execution marks appointment cancelled and frees doctor slot")
    void testProcessCancelAndRefundExecution() {
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(appointment));
        when(doctorSlotRepository.findById(slotId)).thenReturn(Optional.of(doctorSlot));
        when(paymentOrderRepository.findFirstByAppointmentIdOrderByCreatedAtDesc(appointmentId))
                .thenReturn(Optional.of(paymentOrder));

        CancelAndRefundRequest req = new CancelAndRefundRequest("Schedule conflict", 30.0); // >24h -> 100% refund
        CancelAndRefundResponse response = refundService.processCancelAndRefund(appointmentId, patientId, req);

        assertThat(response.appointmentStatus()).isEqualTo("CANCELLED");
        assertThat(response.refundPercentage()).isEqualTo(100);
        assertThat(response.refundAmountPaise()).isEqualTo(50000L);
        assertThat(response.refundId()).isNotNull();

        // Verify slot freed
        assertThat(doctorSlot.isBooked()).isFalse();
        verify(doctorSlotRepository).save(doctorSlot);

        // Verify appointment cancelled
        assertThat(appointment.getStatus()).isEqualTo(AppointmentStatus.CANCELLED);
        verify(appointmentRepository).save(appointment);

        // Verify payment order marked refunded
        assertThat(paymentOrder.getStatus()).isEqualTo(PaymentOrder.Status.REFUNDED);
        verify(paymentOrderRepository).save(paymentOrder);

        // Verify audit log recorded
        verify(paymentRefundRepository).save(any(PaymentRefund.class));
    }
}

