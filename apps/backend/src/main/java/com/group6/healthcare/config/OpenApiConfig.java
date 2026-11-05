package com.group6.healthcare.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI healthcareOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("🏥 PulseCare Healthcare & Payment Gateway API")
                        .description("""
                                ### PulseCare Enterprise Clinical & Financial Platform
                                Integrated with:
                                - **Razorpay Gateway**: Checkout Order creation & HMAC-SHA256 verification.
                                - **Apache Kafka**: Asynchronous event-driven payment streaming pipeline (`payment-receipt-topic`).
                                - **OpenPDF Invoicing**: Official medical tax receipts & GST consultation invoices.
                                - **Gmail SMTP**: JavaMailSender delivery of MIME receipts with PDF attachments.
                                - **Dual WhatsApp Engine**: Primary Meta WhatsApp Cloud API (v21.0) with automatic failover to Twilio Sandbox.
                                
                                💡 **Quick Testbench**:
                                - Run 1-Click Payment Check at `POST /api/v1/payments/testbench/simulate-payment`.
                                - Check All Subsystems at `GET /api/v1/payments/testbench/all-apis-check`.
                                - Or open the visual interactive testbench dashboard at `/api/v1/payments/testbench/ui`.
                                """)
                        .version("v2.1.0")
                        .contact(new Contact().name("PulseCare Systems Team").email("abhibrata.sarkar2020@gmail.com"))
                        .license(new License().name("PulseCare License 2026")))
                .tags(List.of(
                        new Tag().name("00 - Payment & All APIs Testbench").description("One-click Swagger UI simulation for payments, Kafka events, PDF generation, and all system APIs"),
                        new Tag().name("Payments").description("Razorpay order creation, cryptographic HMAC verification, and PDF invoice retrieval"),
                        new Tag().name("Auth").description("JWT Authentication, Patient/Doctor registration, session management"),
                        new Tag().name("Appointments").description("Doctor consultations and appointment booking lifecycle"),
                        new Tag().name("Video Consultations").description("Live WebRTC consultation sessions and clinical summaries"),
                        new Tag().name("Prescriptions").description("Medical prescription management and pharmacist fulfillment")
                ))
                .components(new Components()
                        .addSecuritySchemes(BEARER_SCHEME_NAME,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .in(SecurityScheme.In.HEADER)
                                        .name("Authorization")));
    }
}
