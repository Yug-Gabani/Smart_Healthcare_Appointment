package com.group6.healthcare.auth.service;

import com.group6.healthcare.user.entity.User;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Transactional auth emails (password reset today; email verification + welcome
 * mails tomorrow). Deliberately kept separate from {@code PaymentReceiptEmailService},
 * which is Kafka-driven and pulls receipts off a topic.
 *
 * <p>When SMTP credentials are not configured ({@code spring.mail.username} blank),
 * the service logs the reset link to the application log instead of attempting a
 * send. This keeps local dev usable without requiring a Gmail app-password.</p>
 */
@Service
public class AuthEmailService {

    private static final Logger log = LoggerFactory.getLogger(AuthEmailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.from:no-reply@pulsecare.app}")
    private String mailFrom;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    @Value("${app.product-name:PulseCare}")
    private String productName;

    public void sendPasswordResetEmail(User user, String rawToken, int validityMinutes) {
        String resetUrl = buildResetUrl(rawToken);

        // Always log the link to the server terminal for instant local dev & debugging
        log.info("🔗 [PASSWORD RESET LINK] For {} => {}", user.getEmail(), resetUrl);

        if (mailSender == null || mailUsername == null || mailUsername.isBlank()) {
            log.warn("SMTP credentials not configured; check the link logged above for testing.");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            String sender = (mailFrom != null && !mailFrom.isBlank() && !mailFrom.equalsIgnoreCase("no-reply@pulsecare.app"))
                    ? mailFrom
                    : (mailUsername != null && !mailUsername.isBlank() ? mailUsername : "no-reply@pulsecare.app");
            try {
                helper.setFrom(sender, productName);
            } catch (Exception ex) {
                helper.setFrom(sender);
            }
            helper.setTo(user.getEmail());
            helper.setSubject("Reset your " + productName + " password");
            helper.setText(buildHtmlBody(user, resetUrl, validityMinutes), true);
            mailSender.send(message);
            log.info("Password reset email sent to user id={}", user.getId());
        } catch (Exception e) {
            // Never leak which address did or didn't receive mail back to the caller
            // (which would re-enable account enumeration). Swallow + log.
            log.error("Failed to send password reset email to user id={}", user.getId(), e);
        }
    }

    private String buildResetUrl(String rawToken) {
        String base = appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
        String encoded = URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
        return base + "/auth/reset-password?token=" + encoded;
    }

    private String buildHtmlBody(User user, String resetUrl, int validityMinutes) {
        String firstName = user.getFullName() == null ? "there"
                : user.getFullName().split(" ")[0];
        return """
                <!doctype html>
                <html>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                             color: #1f2a28; background: #f6fbf9; padding: 24px;">
                  <div style="max-width: 520px; margin: 0 auto; background: #ffffff;
                              border: 1px solid #e3eceb; border-radius: 14px; padding: 32px;">
                    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">
                      Reset your %s password
                    </h1>
                    <p style="font-size: 15px; line-height: 1.55; margin: 0 0 20px;">
                      Hi %s — we received a request to reset the password for your account.
                      Click the button below to choose a new one. The link is good for the
                      next %d minutes.
                    </p>
                    <p style="margin: 24px 0;">
                      <a href="%s"
                         style="display: inline-block; padding: 12px 20px; background: #0f766e;
                                color: #ffffff; text-decoration: none; border-radius: 10px;
                                font-weight: 600; font-size: 14px;">
                        Reset password
                      </a>
                    </p>
                    <p style="font-size: 13px; color: #6b7a78; line-height: 1.55; margin: 0 0 8px;">
                      Or paste this link into your browser:
                    </p>
                    <p style="font-size: 12px; color: #6b7a78; word-break: break-all; margin: 0 0 24px;">
                      %s
                    </p>
                    <p style="font-size: 13px; color: #6b7a78; line-height: 1.55; margin: 0;">
                      If you did not request this, you can safely ignore this email — your
                      password will not change.
                    </p>
                  </div>
                </body>
                </html>
                """.formatted(productName, firstName, validityMinutes, resetUrl, resetUrl);
    }
}
