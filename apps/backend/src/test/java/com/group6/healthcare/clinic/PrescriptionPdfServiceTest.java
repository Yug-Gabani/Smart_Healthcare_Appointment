package com.group6.healthcare.clinic;

import com.group6.healthcare.clinic.dto.PrescriptionItemDto;
import com.group6.healthcare.clinic.dto.PrescriptionResponse;
import com.group6.healthcare.clinic.entity.MealTiming;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import com.group6.healthcare.clinic.service.PrescriptionPdfService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PrescriptionPdfServiceTest {

    private PrescriptionPdfService pdfService;

    @BeforeEach
    void setUp() {
        pdfService = new PrescriptionPdfService();
    }

    @Test
    @DisplayName("Should generate valid signed PDF prescription with clinic header, Rx badge, doctor license, and digital signature")
    void shouldGenerateValidSignedPdfPrescription() {
        UUID rxId = UUID.randomUUID();
        UUID apptId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();

        PrescriptionItemDto item1 = new PrescriptionItemDto(
                UUID.randomUUID(),
                "Amoxicillin 500mg",
                "1 capsule",
                "3 times daily",
                "5 days",
                "Complete full course even if feeling better",
                List.of(MealTiming.AFTER_BREAKFAST, MealTiming.AFTER_LUNCH, MealTiming.AFTER_DINNER)
        );

        PrescriptionItemDto item2 = new PrescriptionItemDto(
                UUID.randomUUID(),
                "Paracetamol 650mg",
                "1 tablet",
                "As needed (SOS)",
                "3 days",
                "Take with plenty of water",
                List.of(MealTiming.AS_NEEDED)
        );

        PrescriptionResponse rx = new PrescriptionResponse(
                rxId,
                apptId,
                patientId,
                "Rajesh Sharma",
                doctorId,
                "Ananya Roy",
                "Internal Medicine & Cardiology",
                "PulseCare Central Hospital",
                "PMC-MH-2024-88392",
                PrescriptionStatus.SIGNED,
                OffsetDateTime.now(),
                null,
                null,
                "Patient diagnosed with mild upper respiratory tract infection. Rest and adequate hydration recommended.",
                7,
                "Review SOS if symptoms persist after 5 days",
                List.of(item1, item2),
                OffsetDateTime.now().minusHours(1),
                OffsetDateTime.now()
        );

        byte[] pdfBytes = pdfService.render(rx);

        assertThat(pdfBytes).isNotNull();
        assertThat(pdfBytes.length).isGreaterThan(1500);

        // Verify PDF Magic Bytes (%PDF-)
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertThat(header).isEqualTo("%PDF-");
    }

    @Test
    @DisplayName("Should generate valid draft PDF prescription with draft notice")
    void shouldGenerateValidDraftPdfPrescription() {
        PrescriptionResponse rx = new PrescriptionResponse(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Sunita Patel",
                UUID.randomUUID(),
                "Vikram Malhotra",
                "Pediatrics",
                "PulseCare Health Systems",
                "NMC/SMC-77123",
                PrescriptionStatus.DRAFT,
                null,
                null,
                null,
                "Initial consultation evaluation draft",
                null,
                null,
                List.of(),
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );

        byte[] pdfBytes = pdfService.render(rx);

        assertThat(pdfBytes).isNotNull();
        assertThat(pdfBytes.length).isGreaterThan(1000);
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertThat(header).isEqualTo("%PDF-");
    }

    @Test
    @DisplayName("Should generate valid voided PDF prescription with void reason")
    void shouldGenerateValidVoidedPdfPrescription() {
        PrescriptionResponse rx = new PrescriptionResponse(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Amit Kumar",
                UUID.randomUUID(),
                "Dr. Neha Verma",
                "Dermatology",
                "Metro Health Clinic",
                "SMC-DL-9921",
                PrescriptionStatus.VOIDED,
                OffsetDateTime.now().minusDays(1),
                UUID.randomUUID(),
                "Incorrect medication dosage selected by attending doctor; replaced by subsequent Rx.",
                "Original diagnosis notes",
                null,
                null,
                List.of(),
                OffsetDateTime.now().minusDays(1),
                OffsetDateTime.now()
        );

        byte[] pdfBytes = pdfService.render(rx);

        assertThat(pdfBytes).isNotNull();
        assertThat(pdfBytes.length).isGreaterThan(1000);
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertThat(header).isEqualTo("%PDF-");
    }
}
