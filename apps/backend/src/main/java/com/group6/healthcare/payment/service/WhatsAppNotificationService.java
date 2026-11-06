package com.group6.healthcare.payment.service;

import com.group6.healthcare.payment.event.PaymentSuccessEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.text.NumberFormat;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

@Service
public class WhatsAppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationService.class);

    @Value("${whatsapp.enabled:true}")
    private boolean whatsappEnabled = true;

    @Value("${whatsapp.provider:meta}")
    private String provider = "meta"; // "meta" or "twilio"

    @Value("${whatsapp.twilio.account-sid:}")
    private String twilioAccountSid = "";

    @Value("${whatsapp.twilio.auth-token:}")
    private String twilioAuthToken = "";

    @Value("${whatsapp.twilio.from-number:}")
    private String twilioFromNumber = "";

    @Value("${whatsapp.twilio.content-sid:}")
    private String twilioContentSid = "";

    @Value("${whatsapp.meta.access-token:}")
    private String metaAccessToken = "";

    @Value("${whatsapp.meta.phone-number-id:}")
    private String metaPhoneNumberId = "";

    @Value("${whatsapp.meta.api-version:v21.0}")
    private String metaApiVersion = "v21.0";

    private final HttpClient httpClient = createHttpClient();

    private static HttpClient createHttpClient() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[] {
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }

                        public void checkClientTrusted(X509Certificate[] certs, String authType) {
                        }

                        public void checkServerTrusted(X509Certificate[] certs, String authType) {
                        }
                    }
            };
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new SecureRandom());
            return HttpClient.newBuilder()
                    .sslContext(sslContext)
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
        } catch (Exception e) {
            return HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
        }
    }

    public boolean sendPaymentReceipt(PaymentSuccessEvent event) {
        if (!whatsappEnabled)
            return false;

        String recipientPhone = normalizePhoneNumber(
                event.phoneNumber() != null ? event.phoneNumber() : "+919876543210");
        String formattedAmount = NumberFormat.getCurrencyInstance(new Locale("en", "IN"))
                .format(event.amountPaise() / 100.0);
        String pdfDownloadUrl = "http://localhost:8080/api/v1/payments/receipt/" + event.razorpayOrderId() + "/pdf";
        String appointmentSlot = (event.slotTime() != null && !event.slotTime().isBlank())
                ? event.slotTime()
                : "Today 02:00 PM";

        String messageText = String.format(
                "🏥 *PulseCare Health Systems — Booking Confirmed*\n\n" +
                        "Dear *%s*,\n" +
                        "Your doctor appointment consultation is confirmed and payment has been processed successfully!\n\n"
                        +
                        "📋 *RECEIPT & APPOINTMENT DETAILS*\n" +
                        "• *Doctor:* %s\n" +
                        "• *Patient:* %s\n" +
                        "• *Appointment Slot:* %s\n" +
                        "• *Amount Paid:* %s\n" +
                        "• *Payment ID:* %s\n" +
                        "• *Order ID:* %s\n" +
                        "• *Confirmed At:* %s\n\n" +
                        "📄 *Official PDF Medical Invoice:*\n%s\n\n" +
                        "✅ An attached copy of your PDF receipt has also been dispatched to %s.\n\n" +
                        "Thank you for choosing PulseCare!",
                event.patientName(), event.doctorName(), event.patientName(), appointmentSlot,
                formattedAmount, event.razorpayPaymentId(), event.razorpayOrderId(),
                event.timestamp(), pdfDownloadUrl, event.userEmail());

        return dispatchMessage(recipientPhone, messageText);
    }

    private boolean dispatchMessage(String targetPhone, String body) {
        boolean hasMeta = metaAccessToken != null && !metaAccessToken.isBlank() && metaPhoneNumberId != null
                && !metaPhoneNumberId.isBlank();
        boolean hasTwilio = twilioAccountSid != null && !twilioAccountSid.isBlank()
                && twilioAuthToken != null && !twilioAuthToken.isBlank()
                && twilioFromNumber != null && !twilioFromNumber.isBlank()
                && twilioContentSid != null && !twilioContentSid.isBlank();

        boolean success = false;
        if ("meta".equalsIgnoreCase(provider) && hasMeta) {
            success = sendViaMeta(targetPhone, body);
            if (!success && hasTwilio) {
                log.warn("[WHATSAPP FALLBACK] Meta failed. Falling back to Twilio...");
                success = sendViaTwilio(targetPhone, body);
            }
        } else if ("twilio".equalsIgnoreCase(provider) && hasTwilio) {
            success = sendViaTwilio(targetPhone, body);
            if (!success && hasMeta) {
                log.warn("[WHATSAPP FALLBACK] Twilio failed. Retrying with Meta...");
                success = sendViaMeta(targetPhone, body);
            }
        } else if (hasMeta) {
            success = sendViaMeta(targetPhone, body);
            if (!success && hasTwilio)
                success = sendViaTwilio(targetPhone, body);
        } else if (hasTwilio) {
            success = sendViaTwilio(targetPhone, body);
        }
        return success;
    }

    private boolean sendViaMeta(String targetPhone, String body) {
        try {
            String metaRecipient = targetPhone.replaceAll("[^0-9]", "");
            String endpoint = String.format("https://graph.facebook.com/%s/%s/messages", metaApiVersion,
                    metaPhoneNumberId.trim());

            org.json.JSONObject payload = new org.json.JSONObject();
            payload.put("messaging_product", "whatsapp");
            payload.put("recipient_type", "individual");
            payload.put("to", metaRecipient);
            payload.put("type", "text");

            org.json.JSONObject textObj = new org.json.JSONObject();
            textObj.put("preview_url", true);
            textObj.put("body", body);
            payload.put("text", textObj);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Authorization", "Bearer " + metaAccessToken.trim())
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[WHATSAPP META] Successfully sent message to {}! Status: {}", metaRecipient,
                        response.statusCode());
                return true;
            } else if (response.statusCode() == 403 && response.body().contains("socialweb")) {
                log.error(
                        "[WHATSAPP META] graph.facebook.com blocked by network firewall (socialweb category). Use Hotspot/VPN.");
                return false;
            } else if (response.body().contains("131047") || response.body().contains("24 hours")) {
                log.warn("[WHATSAPP META] Outside 24-hr window. Retrying with template 'hello_world'...");
                return sendMetaTemplate(endpoint, metaRecipient, "hello_world", "en_US");
            } else {
                log.error("[WHATSAPP META] Failed: Status: {}, Response: {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception ex) {
            log.error("[WHATSAPP META] Error: {}", ex.getMessage());
            return false;
        }
    }

    private boolean sendMetaTemplate(String endpoint, String metaRecipient, String templateName, String languageCode) {
        try {
            org.json.JSONObject payload = new org.json.JSONObject();
            payload.put("messaging_product", "whatsapp");
            payload.put("to", metaRecipient);
            payload.put("type", "template");

            org.json.JSONObject templateObj = new org.json.JSONObject();
            templateObj.put("name", templateName);
            org.json.JSONObject langObj = new org.json.JSONObject();
            langObj.put("code", languageCode);
            templateObj.put("language", langObj);
            payload.put("template", templateObj);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Authorization", "Bearer " + metaAccessToken.trim())
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception ex) {
            log.error("[WHATSAPP META TEMPLATE] Error: {}", ex.getMessage());
            return false;
        }
    }

    private boolean sendViaTwilio(String targetPhone, String body) {
        try {
            String cleanPhone = normalizePhoneNumber(
                    targetPhone.startsWith("whatsapp:") ? targetPhone.substring(9) : targetPhone);
            String toParam = "whatsapp:" + cleanPhone;
            String fromParam = twilioFromNumber.startsWith("whatsapp:") ? twilioFromNumber
                    : "whatsapp:" + twilioFromNumber;
            String contentSid = twilioContentSid == null ? "" : twilioContentSid.trim();
            if (twilioAccountSid == null || twilioAccountSid.isBlank()
                    || twilioAuthToken == null || twilioAuthToken.isBlank()
                    || twilioFromNumber == null || twilioFromNumber.isBlank()
                    || contentSid.isBlank()) {
                log.error("[WHATSAPP TWILIO] Required Twilio configuration is missing");
                return false;
            }

            String form = "From=" + URLEncoder.encode(fromParam, StandardCharsets.UTF_8)
                    + "&To=" + URLEncoder.encode(toParam, StandardCharsets.UTF_8)
                    + "&ContentSid=" + URLEncoder.encode(contentSid, StandardCharsets.UTF_8);

            String authHeader = "Basic " + Base64.getEncoder()
                    .encodeToString((twilioAccountSid + ":" + twilioAuthToken).getBytes(StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(String.format("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
                            twilioAccountSid)))
                    .header("Authorization", authHeader)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception ex) {
            log.error("[WHATSAPP TWILIO] Error: {}", ex.getMessage());
            return false;
        }
    }

    public String normalizePhoneNumber(String raw) {
        if (raw == null)
            return "+919876543210";
        String clean = raw.replaceAll("[^0-9+]", "");
        if (clean.startsWith("+"))
            return clean;
        if (clean.length() == 10)
            return "+91" + clean;
        return "+" + clean;
    }
}
