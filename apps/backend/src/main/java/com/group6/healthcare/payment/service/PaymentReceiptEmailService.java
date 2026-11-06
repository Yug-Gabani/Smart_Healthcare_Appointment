package com.group6.healthcare.payment.service;

import com.group6.healthcare.payment.config.KafkaPaymentConfig;
import com.group6.healthcare.payment.entity.NotificationAuditLog;
import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.text.NumberFormat;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class PaymentReceiptEmailService {

    private static final Logger log = LoggerFactory.getLogger(PaymentReceiptEmailService.class);

    private final Set<String> processedPayments = ConcurrentHashMap.newKeySet();
    private final List<PaymentSuccessEvent> receivedEvents = new CopyOnWriteArrayList<>();

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private WhatsAppNotificationService whatsAppService;

    @Autowired
    private PdfReceiptGeneratorService pdfGeneratorService;

    @Autowired(required = false)
    private NotificationAuditService auditService;

    @Autowired(required = false)
    private MinioStorageService minioStorageService;

    @Autowired(required = false)
    private org.springframework.data.redis.core.StringRedisTemplate redisTemplate;

    @Value("${spring.mail.username:abhibrata.sarkar2020@gmail.com}")
    private String mailFrom;

    @KafkaListener(
            topics = KafkaPaymentConfig.PAYMENT_RECEIPT_TOPIC,
            groupId = "payment-receipt-group",
            concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void onPaymentSuccess(PaymentSuccessEvent event) {
        if (event == null || event.razorpayPaymentId() == null) {
            log.warn("[KAFKA CONSUMER] Received null or empty event/payment ID");
            return;
        }

        // 1. Enterprise Distributed Idempotency (Redis cluster + local fallback)
        boolean isDuplicate = false;
        if (redisTemplate != null) {
            try {
                Boolean wasSet = redisTemplate.opsForValue().setIfAbsent(
                        "payment:notified:" + event.razorpayPaymentId(), "1", java.time.Duration.ofDays(7));
                isDuplicate = Boolean.FALSE.equals(wasSet);
            } catch (Exception ex) {
                isDuplicate = !processedPayments.add(event.razorpayPaymentId());
            }
        } else {
            isDuplicate = !processedPayments.add(event.razorpayPaymentId());
        }

        if (isDuplicate) {
            log.info("[KAFKA CONSUMER] Distributed duplicate event for payment {} — SKIPPING", event.razorpayPaymentId());
            return;
        }

        receivedEvents.add(0, event);
        log.info("[KAFKA CONSUMER] Ingested PaymentSuccessEvent for order {} (Payment: {})",
                event.razorpayOrderId(), event.razorpayPaymentId());

        // 2. Generate PDF Receipt & Offload to MinIO/S3 Storage
        byte[] pdfBytes = null;
        String s3DownloadUrl = null;
        try {
            pdfBytes = pdfGeneratorService.generateReceiptPdf(event);
            if (minioStorageService != null && pdfBytes != null) {
                s3DownloadUrl = minioStorageService.uploadReceiptPdf(event.razorpayOrderId(), pdfBytes);
            }
        } catch (Exception ex) {
            log.warn("[KAFKA CONSUMER] Could not generate/store PDF receipt attachment: {}", ex.getMessage());
        }

        // 3. Dispatch Email with PDF Attachment via Gmail SMTP
        try {
            sendEmailReceipt(event, pdfBytes);
            if (auditService != null) {
                auditService.recordLog(
                        event.razorpayOrderId(),
                        event.appointmentId(),
                        NotificationAuditLog.Channel.EMAIL,
                        event.userEmail(),
                        NotificationAuditLog.Status.DISPATCHED,
                        "Official medical PDF receipt dispatched via SMTP to " + event.userEmail()
                );
            }
        } catch (Exception ex) {
            log.error("[KAFKA CONSUMER] Email dispatch failed: {}", ex.getMessage(), ex);
            // Evict from processed set so Kafka can retry redelivery if needed
            processedPayments.remove(event.razorpayPaymentId());
            if (auditService != null) {
                auditService.recordLog(
                        event.razorpayOrderId(),
                        event.appointmentId(),
                        NotificationAuditLog.Channel.EMAIL,
                        event.userEmail(),
                        NotificationAuditLog.Status.FAILED,
                        "Email dispatch error: " + ex.getMessage()
                );
            }
            throw new RuntimeException("Email dispatch failed, triggering Kafka retry/DLQ", ex);
        }

        // 4. Dispatch WhatsApp Notification (Dual Meta/Twilio Engine)
        if (whatsAppService != null) {
            try {
                whatsAppService.sendPaymentReceipt(event);
                if (auditService != null) {
                    auditService.recordLog(
                            event.razorpayOrderId(),
                            event.appointmentId(),
                            NotificationAuditLog.Channel.WHATSAPP,
                            event.phoneNumber(),
                            NotificationAuditLog.Status.DELIVERED,
                            "WhatsApp confirmation and receipt link delivered to " + event.phoneNumber()
                    );
                }
            } catch (Exception ex) {
                log.error("[KAFKA CONSUMER] WhatsApp notification failed: {}", ex.getMessage());
                if (auditService != null) {
                    auditService.recordLog(
                            event.razorpayOrderId(),
                            event.appointmentId(),
                            NotificationAuditLog.Channel.WHATSAPP,
                            event.phoneNumber(),
                            NotificationAuditLog.Status.FAILED,
                            "WhatsApp dispatch error: " + ex.getMessage()
                    );
                }
            }
        }
    }

    /**
     * Dead Letter Queue (DLQ) Consumer for poison pills and unrecoverable delivery errors.
     */
    @KafkaListener(
            topics = KafkaPaymentConfig.PAYMENT_RECEIPT_DLQ_TOPIC,
            groupId = "payment-receipt-dlq-group"
    )
    public void onDeadLetterEvent(PaymentSuccessEvent event) {
        if (event == null) return;
        log.error("[KAFKA DLQ CONSUMER] Poison pill received in DLQ topic '{}' for order {} (Payment ID: {})",
                KafkaPaymentConfig.PAYMENT_RECEIPT_DLQ_TOPIC, event.razorpayOrderId(), event.razorpayPaymentId());

        if (auditService != null) {
            auditService.recordLog(
                    event.razorpayOrderId(),
                    event.appointmentId(),
                    NotificationAuditLog.Channel.DLQ,
                    event.userEmail(),
                    NotificationAuditLog.Status.DLQ_ROUTED,
                    "Max consumer retry attempts exhausted. Message safely quarantined in Dead Letter Queue (DLQ)."
            );
        }
    }

    private void sendEmailReceipt(PaymentSuccessEvent event, byte[] pdfBytes) throws Exception {
        if (mailSender == null) {
            log.warn("[EMAIL SERVICE] JavaMailSender is not configured or disabled. Skipping email dispatch.");
            return;
        }

        if (event.userEmail() == null || event.userEmail().isBlank()) {
            log.warn("[EMAIL SERVICE] No recipient email specified in PaymentSuccessEvent.");
            return;
        }

        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

        helper.setFrom(mailFrom);
        helper.setTo(event.userEmail());
        helper.setSubject("🏥 PulseCare Health Systems — Booking Confirmed & Invoice [" + event.razorpayOrderId() + "]");
        helper.setText(buildHtmlEmail(event), true);

        if (pdfBytes != null && pdfBytes.length > 0) {
            String attachmentName = "PulseCare_Invoice_" + event.razorpayOrderId() + ".pdf";
            helper.addAttachment(attachmentName, new ByteArrayResource(pdfBytes), "application/pdf");
        }

        mailSender.send(mimeMessage);
        log.info("[EMAIL SERVICE] Sent confirmation email with PDF invoice to {}", event.userEmail());
    }

    private String buildHtmlEmail(PaymentSuccessEvent event) {
        String formattedAmount = NumberFormat.getCurrencyInstance(new Locale("en", "IN"))
                .format(event.amountPaise() / 100.0);
        String slotTime = (event.slotTime() != null && !event.slotTime().isBlank())
                ? event.slotTime() : "Today 02:00 PM";

        return """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8"/>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
                .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
                .header { background: linear-gradient(135deg, #0e7490, #0891b2); padding: 28px 24px; color: #ffffff; text-align: center; }
                .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
                .header p { margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe; }
                .badge-bar { background: #f0fdf4; border-bottom: 1px solid #bbf7d0; padding: 12px 24px; display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #166534; }
                .content { padding: 24px; }
                .detail-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0; }
                .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
                .label { color: #64748b; font-weight: 500; }
                .value { color: #0f172a; font-weight: 600; text-align: right; }
                .total-row { border-top: 2px dashed #cbd5e1; margin-top: 8px; padding-top: 10px; font-size: 16px; color: #0e7490; font-weight: 700; }
                .footer { background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="header">
                  <h1>🏥 PulseCare Health Systems</h1>
                  <p>Appointment Booking Confirmed & Official Medical Invoice</p>
                </div>
                <div class="badge-bar">
                  <span>● PAYMENT STATUS: VERIFIED & CONFIRMED</span>
                </div>
                <div class="content">
                  <p>Dear <strong>%s</strong>,</p>
                  <p>Thank you for choosing PulseCare. Your appointment consultation has been successfully booked and paid for.</p>
                  
                  <div class="detail-box">
                    <div class="row"><span class="label">Specialist Doctor:</span><span class="value">%s</span></div>
                    <div class="row"><span class="label">Patient Name:</span><span class="value">%s</span></div>
                    <div class="row"><span class="label">Appointment Slot:</span><span class="value" style="color:#0e7490;">%s</span></div>
                    <div class="row"><span class="label">Razorpay Order ID:</span><span class="value">%s</span></div>
                    <div class="row"><span class="label">Payment ID:</span><span class="value">%s</span></div>
                    <div class="row total-row"><span class="label" style="color:#0e7490;">Total Amount Paid:</span><span class="value" style="color:#0e7490;">%s</span></div>
                  </div>
                  
                  <p style="font-size: 13px; color: #475569;">
                    📎 <strong>PDF Tax Receipt Attached:</strong> A signed medical invoice has been attached to this email for your insurance or personal records.
                  </p>
                </div>
                <div class="footer">
                  PulseCare Health Systems • 24x7 Digital Clinical Infrastructure • Secure Payment Gateway
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                event.patientName() != null ? event.patientName() : "Patient",
                event.doctorName() != null ? event.doctorName() : "Specialist Consultant",
                event.patientName() != null ? event.patientName() : "Patient",
                slotTime,
                event.razorpayOrderId(),
                event.razorpayPaymentId(),
                formattedAmount
        );
    }

    public List<PaymentSuccessEvent> getReceivedEvents() {
        return Collections.unmodifiableList(receivedEvents);
    }

    public Set<String> getProcessedPayments() {
        return Collections.unmodifiableSet(processedPayments);
    }
}

