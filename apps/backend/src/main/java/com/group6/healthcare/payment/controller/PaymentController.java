package com.group6.healthcare.payment.controller;

import com.group6.healthcare.auth.service.AppUserPrincipal;
import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.payment.dto.CancelAndRefundRequest;
import com.group6.healthcare.payment.dto.CancelAndRefundResponse;
import com.group6.healthcare.payment.dto.CreatePaymentOrderRequest;
import com.group6.healthcare.payment.dto.CreatePaymentOrderResponse;
import com.group6.healthcare.payment.dto.RefundPreviewResponse;
import com.group6.healthcare.payment.dto.VerifyPaymentRequest;
import com.group6.healthcare.payment.dto.VerifyPaymentResponse;
import com.group6.healthcare.payment.entity.NotificationAuditLog;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.entity.PaymentRefund;
import com.group6.healthcare.payment.service.NotificationAuditService;
import com.group6.healthcare.payment.service.PaymentService;
import com.group6.healthcare.payment.service.RefundService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
@Tag(name = "Payments", description = "Razorpay checkout, cryptographic verification, medical PDF tax receipts, and tiered refunds")
public class PaymentController {

    private final PaymentService paymentService;
    private final NotificationAuditService auditService;
    private final RefundService refundService;

    public PaymentController(
            PaymentService paymentService,
            NotificationAuditService auditService,
            RefundService refundService
    ) {
        this.paymentService = paymentService;
        this.auditService = auditService;
        this.refundService = refundService;
    }

    @PostMapping("/create-order")
    @Operation(summary = "Create Razorpay Payment Order (or Sandbox Order if offline)")
    public ResponseEntity<ApiResponse<CreatePaymentOrderResponse>> createOrder(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody CreatePaymentOrderRequest req) {
        UUID authUserId = (principal != null) ? principal.getId() : null;
        CreatePaymentOrderResponse resp = paymentService.createOrder(req, authUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(resp, "Payment order created successfully"));
    }

    @PostMapping("/verify")
    @Operation(summary = "Cryptographically verify Razorpay payment HMAC signature and dispatch Kafka pipeline")
    public ResponseEntity<ApiResponse<VerifyPaymentResponse>> verifyPayment(
            @Valid @RequestBody VerifyPaymentRequest req) {
        VerifyPaymentResponse resp = paymentService.verifyPayment(req);
        return ResponseEntity.ok(ApiResponse.ok(resp, "Payment verified successfully"));
    }

    @GetMapping("/receipt/{orderId}/pdf")
    @Operation(summary = "Download or stream official OpenPDF Medical Tax Invoice")
    public ResponseEntity<byte[]> getReceiptPdf(@PathVariable String orderId) {
        byte[] pdfBytes = paymentService.getReceiptPdf(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("inline", "PulseCare_Receipt_" + orderId + ".pdf");
        headers.setContentLength(pdfBytes.length);

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    @GetMapping("/orders")
    @Operation(summary = "List all payment transaction orders")
    public ResponseEntity<ApiResponse<List<PaymentOrder>>> getAllOrders() {
        List<PaymentOrder> orders = paymentService.getAllOrders();
        return ResponseEntity.ok(ApiResponse.ok(orders, "Fetched all payment orders"));
    }

    @GetMapping("/orders/{orderId}")
    @Operation(summary = "Get payment transaction order by Razorpay Order ID")
    public ResponseEntity<ApiResponse<PaymentOrder>> getOrderById(@PathVariable String orderId) {
        PaymentOrder order = paymentService.getOrderByRazorpayId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("PaymentOrder not found: " + orderId));
        return ResponseEntity.ok(ApiResponse.ok(order, "Fetched payment order"));
    }

    @GetMapping("/{orderId}/notifications")
    @Operation(summary = "Get end-to-end notification audit trail for an order (Kafka -> Email -> WhatsApp -> DLQ -> Refund)")
    public ResponseEntity<ApiResponse<List<NotificationAuditLog>>> getOrderNotificationAudit(@PathVariable String orderId) {
        List<NotificationAuditLog> logs = auditService.getLogsForOrder(orderId);
        return ResponseEntity.ok(ApiResponse.ok(logs, "Fetched notification audit trail"));
    }

    @GetMapping("/notifications/audit")
    @Operation(summary = "Get global recent notification audit logs across all channels")
    public ResponseEntity<ApiResponse<List<NotificationAuditLog>>> getGlobalNotificationAudit() {
        List<NotificationAuditLog> logs = auditService.getRecentLogs();
        return ResponseEntity.ok(ApiResponse.ok(logs, "Fetched recent notification audit logs"));
    }

    // ==========================================
    // Tiered Cancellation & Razorpay Refund APIs
    // ==========================================

    @GetMapping("/appointments/{appointmentId}/refund-preview")
    @Operation(summary = "Calculate tiered refund preview for an appointment based on time remaining before slot")
    public ResponseEntity<ApiResponse<RefundPreviewResponse>> getRefundPreview(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID appointmentId,
            @RequestParam(name = "simulatedHours", required = false) Double simulatedHours
    ) {
        UUID userId = (principal != null) ? principal.getId() : null;
        RefundPreviewResponse resp = refundService.getRefundPreview(appointmentId, userId, simulatedHours);
        return ResponseEntity.ok(ApiResponse.ok(resp, "Refund calculation preview ready"));
    }

    @PostMapping("/appointments/{appointmentId}/cancel-and-refund")
    @Operation(summary = "Cancel appointment, release slot, and process tiered Razorpay refund")
    public ResponseEntity<ApiResponse<CancelAndRefundResponse>> cancelAndRefund(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID appointmentId,
            @RequestBody(required = false) CancelAndRefundRequest req
    ) {
        UUID userId = (principal != null) ? principal.getId() : null;
        CancelAndRefundResponse resp = refundService.processCancelAndRefund(appointmentId, userId, req);
        return ResponseEntity.ok(ApiResponse.ok(resp, resp.policyMessage()));
    }

    @GetMapping("/appointments/{appointmentId}/refund-status")
    @Operation(summary = "Get refund audit details for an appointment")
    public ResponseEntity<ApiResponse<PaymentRefund>> getRefundStatus(@PathVariable UUID appointmentId) {
        PaymentRefund refund = refundService.getRefundDetails(appointmentId)
                .orElse(null);
        return ResponseEntity.ok(ApiResponse.ok(refund, refund != null ? "Refund record found" : "No refund record found"));
    }
}
