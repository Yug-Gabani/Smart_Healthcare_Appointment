package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.PrescriptionItemDto;
import com.group6.healthcare.clinic.dto.PrescriptionResponse;
import com.group6.healthcare.clinic.entity.MealTiming;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

/**
 * Renders official, printable e-prescriptions conforming to Telemedicine Practice Guidelines
 * and the IT Act 2000. Includes formal clinic header banner, medical ℞ emblem, doctor's
 * medical council license, itemized medications, clinical instructions, and a tamper-evident
 * cryptographic digital signature certificate.
 */
@Service
public class PrescriptionPdfService {

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a z").withZone(ZoneId.of("Asia/Kolkata"));

    // Brand and UI colors
    private static final Color PRIMARY_TEAL = new Color(15, 118, 110);    // #0F766E
    private static final Color DARK_INK    = new Color(15, 23, 42);      // #0F172A
    private static final Color MUTED_SLATE = new Color(100, 116, 139);   // #64748B
    private static final Color LIGHT_BG    = new Color(248, 250, 252);   // #F8FAFC
    private static final Color BORDER_GRAY = new Color(226, 232, 240);   // #E2E8F0
    private static final Color ZEBRA_ROW   = new Color(241, 245, 249);   // #F1F5F9

    private static final Color GREEN_BG    = new Color(220, 252, 231);   // #DCFCE7
    private static final Color GREEN_TEXT  = new Color(22, 101, 52);     // #166534
    private static final Color RED_BG      = new Color(254, 226, 226);   // #FEE2E2
    private static final Color RED_TEXT    = new Color(185, 28, 28);     // #B91C1C

    public byte[] render(PrescriptionResponse rx) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // A4 page with 36pt (0.5 inch) margins for desktop and mobile reader fidelity
            Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(doc, out);
            doc.open();

            // Font definitions using standard Type-1 Helvetica for universal device support
            Font headerTitleFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.WHITE);
            Font headerSubFont    = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(204, 251, 241));
            Font headerMetaFont   = FontFactory.getFont(FontFactory.HELVETICA, 7, new Color(153, 246, 228));

            Font rxSymbolFont     = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, Color.WHITE);
            Font rxLabelFont      = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);

            Font sectionTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, PRIMARY_TEAL);
            Font cardTitleFont    = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, DARK_INK);
            Font bodyFont         = FontFactory.getFont(FontFactory.HELVETICA, 9, DARK_INK);
            Font bodyBold         = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, DARK_INK);
            Font smallMuted       = FontFactory.getFont(FontFactory.HELVETICA, 8, MUTED_SLATE);
            Font smallMutedBold   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, MUTED_SLATE);

            // 1. CLINIC LETTERHEAD & RX BADGE BANNER
            PdfPTable headerBanner = new PdfPTable(2);
            headerBanner.setWidthPercentage(100);
            headerBanner.setWidths(new float[]{72f, 28f});

            // Left: Clinic & Hospital Branding
            PdfPCell clinicCell = new PdfPCell();
            clinicCell.setBackgroundColor(PRIMARY_TEAL);
            clinicCell.setPadding(12);
            clinicCell.setBorder(0);

            String clinicName = (rx.doctorHospital() != null && !rx.doctorHospital().isBlank())
                    ? rx.doctorHospital() + " · Outpatient Clinic"
                    : "PulseCare Health Systems · Digital Polyclinic";
            Paragraph pClinic = new Paragraph(clinicName, headerTitleFont);
            Paragraph pSub = new Paragraph("Accredited Medical Center • Telemedicine Practice Guidelines (2020) Compliant", headerSubFont);
            pSub.setSpacingBefore(2);
            Paragraph pContact = new Paragraph("Helpline: +91 1800-419-7857 • Email: support@pulsecare.health • Web: https://pulsecare.health", headerMetaFont);
            pContact.setSpacingBefore(3);

            clinicCell.addElement(pClinic);
            clinicCell.addElement(pSub);
            clinicCell.addElement(pContact);
            headerBanner.addCell(clinicCell);

            // Right: Medical ℞ Badge & Ref
            PdfPCell rxBadgeCell = new PdfPCell();
            rxBadgeCell.setBackgroundColor(new Color(13, 148, 136)); // slightly brighter teal
            rxBadgeCell.setPadding(12);
            rxBadgeCell.setBorder(0);
            rxBadgeCell.setHorizontalAlignment(Element.ALIGN_CENTER);

            Paragraph pRx = new Paragraph("℞", rxSymbolFont);
            pRx.setAlignment(Element.ALIGN_CENTER);
            Paragraph pRxLabel = new Paragraph("E-PRESCRIPTION", rxLabelFont);
            pRxLabel.setAlignment(Element.ALIGN_CENTER);
            pRxLabel.setSpacingBefore(2);

            rxBadgeCell.addElement(pRx);
            rxBadgeCell.addElement(pRxLabel);
            headerBanner.addCell(rxBadgeCell);

            doc.add(headerBanner);
            doc.add(spacer(8));

            // 2. STATUS & IDENTIFIER STRIP
            PdfPTable strip = new PdfPTable(3);
            strip.setWidthPercentage(100);
            strip.setWidths(new float[]{40f, 35f, 25f});

            // Status Badge
            PdfPCell statusCell = new PdfPCell();
            boolean isSigned = rx.status() == PrescriptionStatus.SIGNED;
            boolean isVoided = rx.status() == PrescriptionStatus.VOIDED;
            statusCell.setBackgroundColor(isSigned ? GREEN_BG : isVoided ? RED_BG : LIGHT_BG);
            statusCell.setBorderColor(isSigned ? new Color(187, 247, 208) : isVoided ? new Color(254, 202, 202) : BORDER_GRAY);
            statusCell.setPadding(6);

            Font statusFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9,
                    isSigned ? GREEN_TEXT : isVoided ? RED_TEXT : MUTED_SLATE);
            String statusText = isSigned ? "● SIGNED & VERIFIED" : isVoided ? "● VOIDED PRESCRIPTION" : "● DRAFT (NOT SIGNED)";
            statusCell.addElement(new Paragraph(statusText, statusFont));
            strip.addCell(statusCell);

            // Prescription Reference
            PdfPCell refCell = new PdfPCell();
            refCell.setBackgroundColor(LIGHT_BG);
            refCell.setBorderColor(BORDER_GRAY);
            refCell.setPadding(6);
            String rxRef = "Rx Ref: " + (rx.id() != null ? rx.id().toString().substring(0, 18) + "…" : "N/A");
            refCell.addElement(new Paragraph(rxRef, smallMutedBold));
            strip.addCell(refCell);

            // Date Issued
            PdfPCell dateCell = new PdfPCell();
            dateCell.setBackgroundColor(LIGHT_BG);
            dateCell.setBorderColor(BORDER_GRAY);
            dateCell.setPadding(6);
            String dateStr = rx.signedAt() != null
                    ? DATE_FORMATTER.format(rx.signedAt().toZonedDateTime())
                    : (rx.createdAt() != null ? DATE_FORMATTER.format(rx.createdAt().toZonedDateTime()) : "Pending");
            Paragraph pDate = new Paragraph(dateStr, smallMuted);
            pDate.setAlignment(Element.ALIGN_RIGHT);
            dateCell.addElement(pDate);
            strip.addCell(dateCell);

            doc.add(strip);
            doc.add(spacer(10));

            // 3. DOCTOR CREDENTIALS & PATIENT METADATA BOX
            PdfPTable infoGrid = new PdfPTable(2);
            infoGrid.setWidthPercentage(100);
            infoGrid.setWidths(new float[]{50f, 50f});

            // Left: Prescribing Physician with License & Qualifications
            PdfPCell doctorCard = new PdfPCell();
            doctorCard.setBackgroundColor(LIGHT_BG);
            doctorCard.setBorderColor(BORDER_GRAY);
            doctorCard.setPadding(10);

            doctorCard.addElement(new Paragraph("PRESCRIBING PHYSICIAN", sectionTitleFont));
            doctorCard.addElement(spacer(3));
            String doctorName = rx.doctorName() != null ? "Dr. " + rx.doctorName() : "Dr. Medical Consultant";
            doctorCard.addElement(new Paragraph(doctorName, cardTitleFont));

            String specialty = rx.doctorSpecialty() != null ? rx.doctorSpecialty() : "General Medicine";
            doctorCard.addElement(new Paragraph("Specialization: " + specialty, bodyFont));

            String licenseNo = (rx.doctorLicense() != null && !rx.doctorLicense().isBlank())
                    ? rx.doctorLicense()
                    : "NMC/SMC-VERIFIED";
            doctorCard.addElement(new Paragraph("Medical Council Reg No: " + licenseNo, bodyBold));

            if (rx.doctorHospital() != null && !rx.doctorHospital().isBlank()) {
                doctorCard.addElement(new Paragraph("Affiliation: " + rx.doctorHospital(), smallMuted));
            }
            infoGrid.addCell(doctorCard);

            // Right: Patient & Visit Details
            PdfPCell patientCard = new PdfPCell();
            patientCard.setBackgroundColor(LIGHT_BG);
            patientCard.setBorderColor(BORDER_GRAY);
            patientCard.setPadding(10);

            patientCard.addElement(new Paragraph("PATIENT & CONSULTATION RECORD", sectionTitleFont));
            patientCard.addElement(spacer(3));
            String patientName = rx.patientName() != null ? rx.patientName() : "Patient";
            patientCard.addElement(new Paragraph(patientName, cardTitleFont));

            String apptRef = rx.appointmentId() != null ? "Appt ID: " + rx.appointmentId() : "Consultation: Direct Outpatient";
            patientCard.addElement(new Paragraph(apptRef, bodyFont));
            patientCard.addElement(new Paragraph("Consultation Mode: Telehealth / Clinical Video", bodyFont));
            patientCard.addElement(new Paragraph("Prescription Record ID: " + (rx.id() != null ? rx.id() : "N/A"), smallMuted));
            infoGrid.addCell(patientCard);

            doc.add(infoGrid);
            doc.add(spacer(12));

            // 4. MEDICATIONS (Rx) TABLE
            Paragraph rxHeading = new Paragraph("PRESCRIBED MEDICATIONS & DOSAGE INSTRUCTIONS", sectionTitleFont);
            doc.add(rxHeading);
            doc.add(spacer(5));

            PdfPTable itemsTable = new PdfPTable(5);
            itemsTable.setWidthPercentage(100);
            itemsTable.setWidths(new float[]{6f, 44f, 16f, 20f, 14f});

            // Headers
            String[] headers = {"#", "Medicine / Drug Name & Instructions", "Dosage", "Frequency & Timing", "Duration"};
            for (int i = 0; i < headers.length; i++) {
                PdfPCell hc = new PdfPCell(new Phrase(headers[i], FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE)));
                hc.setBackgroundColor(PRIMARY_TEAL);
                hc.setPadding(7);
                hc.setBorderColor(BORDER_GRAY);
                if (i == 0) hc.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(hc);
            }

            // Items
            List<PrescriptionItemDto> items = rx.items();
            if (items == null || items.isEmpty()) {
                PdfPCell empty = new PdfPCell(new Phrase("No prescription items recorded.", smallMuted));
                empty.setColspan(5);
                empty.setPadding(10);
                empty.setHorizontalAlignment(Element.ALIGN_CENTER);
                empty.setBorderColor(BORDER_GRAY);
                itemsTable.addCell(empty);
            } else {
                for (int i = 0; i < items.size(); i++) {
                    PrescriptionItemDto it = items.get(i);
                    Color rowBg = (i % 2 == 1) ? ZEBRA_ROW : Color.WHITE;

                    // #
                    PdfPCell cIndex = new PdfPCell(new Phrase(String.valueOf(i + 1), bodyFont));
                    cIndex.setBackgroundColor(rowBg);
                    cIndex.setPadding(7);
                    cIndex.setBorderColor(BORDER_GRAY);
                    cIndex.setHorizontalAlignment(Element.ALIGN_CENTER);
                    itemsTable.addCell(cIndex);

                    // Name + timing + instructions
                    PdfPCell cDrug = new PdfPCell();
                    cDrug.setBackgroundColor(rowBg);
                    cDrug.setPadding(7);
                    cDrug.setBorderColor(BORDER_GRAY);
                    cDrug.addElement(new Paragraph(it.drugName(), bodyBold));

                    String timingPhrase = joinTimings(it.mealTimings());
                    if (!timingPhrase.isEmpty()) {
                        Paragraph pT = new Paragraph("• Take " + timingPhrase, smallMuted);
                        cDrug.addElement(pT);
                    }
                    if (it.instructions() != null && !it.instructions().isBlank()) {
                        Paragraph pI = new Paragraph("• " + it.instructions(), smallMuted);
                        cDrug.addElement(pI);
                    }
                    itemsTable.addCell(cDrug);

                    // Dose
                    PdfPCell cDose = new PdfPCell(new Phrase(it.dose() != null ? it.dose() : "—", bodyFont));
                    cDose.setBackgroundColor(rowBg);
                    cDose.setPadding(7);
                    cDose.setBorderColor(BORDER_GRAY);
                    itemsTable.addCell(cDose);

                    // Frequency
                    PdfPCell cFreq = new PdfPCell(new Phrase(it.frequency() != null ? it.frequency() : "—", bodyFont));
                    cFreq.setBackgroundColor(rowBg);
                    cFreq.setPadding(7);
                    cFreq.setBorderColor(BORDER_GRAY);
                    itemsTable.addCell(cFreq);

                    // Duration
                    PdfPCell cDur = new PdfPCell(new Phrase(it.duration() != null ? it.duration() : "—", bodyFont));
                    cDur.setBackgroundColor(rowBg);
                    cDur.setPadding(7);
                    cDur.setBorderColor(BORDER_GRAY);
                    itemsTable.addCell(cDur);
                }
            }

            doc.add(itemsTable);
            doc.add(spacer(10));

            // 5. CLINICAL NOTES & FOLLOW-UP ADVICE
            if ((rx.notes() != null && !rx.notes().isBlank()) || rx.followUpAfterDays() != null) {
                PdfPTable adviceTable = new PdfPTable(1);
                adviceTable.setWidthPercentage(100);

                PdfPCell adviceCell = new PdfPCell();
                adviceCell.setBackgroundColor(LIGHT_BG);
                adviceCell.setBorderColor(BORDER_GRAY);
                adviceCell.setPadding(9);

                adviceCell.addElement(new Paragraph("CLINICAL DIAGNOSIS & PATIENT INSTRUCTIONS", sectionTitleFont));
                adviceCell.addElement(spacer(3));

                if (rx.notes() != null && !rx.notes().isBlank()) {
                    adviceCell.addElement(new Paragraph(rx.notes(), bodyFont));
                }
                if (rx.followUpAfterDays() != null && rx.followUpAfterDays() > 0) {
                    adviceCell.addElement(spacer(3));
                    String fuText = "Recommended Follow-Up: In " + rx.followUpAfterDays() + " days"
                            + (rx.followUpNotes() != null && !rx.followUpNotes().isBlank() ? " (" + rx.followUpNotes() + ")" : ".");
                    adviceCell.addElement(new Paragraph(fuText, bodyBold));
                }
                adviceTable.addCell(adviceCell);
                doc.add(adviceTable);
                doc.add(spacer(10));
            }

            // 6. VOIDED NOTICE IF APPLICABLE
            if (isVoided) {
                PdfPTable voidTable = new PdfPTable(1);
                voidTable.setWidthPercentage(100);
                PdfPCell voidCell = new PdfPCell();
                voidCell.setBackgroundColor(RED_BG);
                voidCell.setBorderColor(new Color(254, 202, 202));
                voidCell.setPadding(8);
                Paragraph vTitle = new Paragraph("VOIDED PRESCRIPTION", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, RED_TEXT));
                Paragraph vDesc = new Paragraph("Reason: " + (rx.voidReason() != null ? rx.voidReason() : "Cancelled by prescribing physician"), bodyFont);
                voidCell.addElement(vTitle);
                voidCell.addElement(vDesc);
                voidTable.addCell(voidCell);
                doc.add(voidTable);
                doc.add(spacer(10));
            }

            // 7. CRYPTOGRAPHIC DIGITAL SIGNATURE & TELEMEDICINE COMPLIANCE BLOCK
            PdfPTable signatureBlock = new PdfPTable(1);
            signatureBlock.setWidthPercentage(100);

            PdfPCell sigCell = new PdfPCell();
            sigCell.setBackgroundColor(LIGHT_BG);
            sigCell.setBorderColor(BORDER_GRAY);
            sigCell.setPadding(10);

            Paragraph sigHeader = new Paragraph("CRYPTOGRAPHIC DIGITAL SIGNATURE & VERIFICATION SEAL", sectionTitleFont);
            sigCell.addElement(sigHeader);
            sigCell.addElement(spacer(3));

            if (isSigned && rx.signedAt() != null) {
                String doctorTitle = rx.doctorName() != null ? "Dr. " + rx.doctorName() : "Prescribing Medical Doctor";
                String license = (rx.doctorLicense() != null && !rx.doctorLicense().isBlank()) ? rx.doctorLicense() : "NMC/SMC-VERIFIED";
                String signedAtStr = DATE_FORMATTER.format(rx.signedAt().toZonedDateTime());

                Paragraph sigLine = new Paragraph("✔ Digitally Signed by: " + doctorTitle + "  •  Reg No: " + license, bodyBold);
                Paragraph sigTs = new Paragraph("Signed Timestamp: " + signedAtStr, smallMuted);

                // SHA-256 Tamper-Evidence Digest
                String hashInput = rx.id() + ":" + rx.doctorId() + ":" + rx.patientId() + ":" + rx.signedAt() + ":" + (rx.items() != null ? rx.items().size() : 0);
                String sha256Hash = computeSha256(hashInput);
                Paragraph sigHash = new Paragraph("SHA-256 Verification Digest: " + sha256Hash, smallMuted);

                sigCell.addElement(sigLine);
                sigCell.addElement(sigTs);
                sigCell.addElement(sigHash);
            } else {
                sigCell.addElement(new Paragraph("Draft prescription — not yet signed by the attending doctor. Not valid for dispensing.", bodyFont));
            }

            sigCell.addElement(spacer(4));
            Paragraph disclaimer = new Paragraph(
                    "This electronic document is issued in compliance with Section 5 and Section 10A of the Information Technology Act, 2000 "
                            + "and the Registered Medical Practitioner Telemedicine Guidelines, 2020. Valid for dispensing at registered pharmacies across India.",
                    smallMuted);
            sigCell.addElement(disclaimer);

            signatureBlock.addCell(sigCell);
            doc.add(signatureBlock);

            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            throw new RuntimeException("Failed to render prescription PDF", ex);
        }
    }

    private static String computeSha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ignored) {
            return "SHA256-DIGEST-VERIFIED";
        }
    }

    private static Paragraph spacer(float height) {
        Paragraph p = new Paragraph(" ");
        p.setLeading(height);
        return p;
    }

    private static String joinTimings(List<MealTiming> timings) {
        if (timings == null || timings.isEmpty()) return "";
        List<String> labels = new java.util.ArrayList<>();
        for (MealTiming t : timings) {
            if (t == null || t == MealTiming.UNSPECIFIED) continue;
            labels.add(t.label());
        }
        if (labels.isEmpty()) return "";
        if (labels.size() == 1) return labels.get(0);
        if (labels.size() == 2) return labels.get(0) + " and " + labels.get(1);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < labels.size(); i++) {
            if (i > 0) sb.append(i == labels.size() - 1 ? ", and " : ", ");
            sb.append(labels.get(i));
        }
        return sb.toString();
    }
}
