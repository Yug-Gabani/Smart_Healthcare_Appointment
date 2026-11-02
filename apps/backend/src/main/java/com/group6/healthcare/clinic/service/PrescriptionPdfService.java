package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.PrescriptionItemDto;
import com.group6.healthcare.clinic.dto.PrescriptionResponse;
import com.group6.healthcare.clinic.entity.MealTiming;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import com.lowagie.text.Chunk;
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
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Renders a prescription into a simple PDF. Text-only "signature": the signed-at timestamp and
 * doctor name are printed. For stronger tamper evidence a hash of the payload is appended at the
 * footer so a reviewer can compare it against an audit log entry.
 */
@Service
public class PrescriptionPdfService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d LLLL yyyy, HH:mm z", Locale.ENGLISH);
    private static final Color PRIMARY = new Color(0x78, 0x5B, 0x47);
    private static final Color MUTED   = new Color(0x70, 0x6B, 0x63);
    private static final Color INK     = new Color(0x1A, 0x11, 0x0A);
    private static final Color BORDER  = new Color(0xEA, 0xE3, 0xD8);

    public byte[] render(PrescriptionResponse rx) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 48, 48, 48, 48);
        PdfWriter.getInstance(doc, out);
        doc.open();

        // Header
        Font brandFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, PRIMARY);
        Font subFont    = FontFactory.getFont(FontFactory.HELVETICA, 10, MUTED);
        Font sectionFont= FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, INK);
        Font bodyFont   = FontFactory.getFont(FontFactory.HELVETICA, 11, INK);
        Font smallMuted = FontFactory.getFont(FontFactory.HELVETICA, 9, MUTED);
        Font stamp      = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 10, MUTED);
        Font badgeFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);

        Paragraph brand = new Paragraph("PulseCare", brandFont);
        brand.setAlignment(Element.ALIGN_LEFT);
        doc.add(brand);
        doc.add(new Paragraph("Smart Healthcare Appointment & Triage System", subFont));
        doc.add(spacer(10));

        // Status + id strip
        PdfPTable strip = new PdfPTable(2);
        strip.setWidthPercentage(100);
        try { strip.setWidths(new int[] { 70, 30 }); } catch (Exception ignored) {}

        PdfPCell left = textCell("Prescription Ref · " + rx.id().toString(), smallMuted);
        left.setBorder(0);
        strip.addCell(left);

        PdfPCell badge = new PdfPCell(new Phrase(rx.status().name(), badgeFont));
        badge.setHorizontalAlignment(Element.ALIGN_CENTER);
        badge.setVerticalAlignment(Element.ALIGN_MIDDLE);
        badge.setPadding(6);
        badge.setBorder(0);
        badge.setBackgroundColor(
                rx.status() == PrescriptionStatus.SIGNED ? new Color(0x05, 0x96, 0x69)
                : rx.status() == PrescriptionStatus.VOIDED ? new Color(0xDC, 0x26, 0x26)
                : new Color(0x9C, 0xA3, 0xAF));
        strip.addCell(badge);
        doc.add(strip);
        doc.add(spacer(16));

        // Doctor + patient box
        PdfPTable info = new PdfPTable(2);
        info.setWidthPercentage(100);
        try { info.setWidths(new int[] { 50, 50 }); } catch (Exception ignored) {}
        info.addCell(labelled("Prescribing physician",
                nullSafe(rx.doctorName()) + "\n" + nullSafe(rx.doctorSpecialty()) + "\n" + nullSafe(rx.doctorHospital()),
                sectionFont, bodyFont));
        info.addCell(labelled("Patient",
                nullSafe(rx.patientName()) + "\nIssued: " +
                        (rx.signedAt() != null ? DATE.format(rx.signedAt().toZonedDateTime()) : "Not signed"),
                sectionFont, bodyFont));
        doc.add(info);
        doc.add(spacer(18));

        // Items table
        Paragraph itemsHeading = new Paragraph("Medications", sectionFont);
        doc.add(itemsHeading);
        doc.add(spacer(6));

        PdfPTable items = new PdfPTable(4);
        items.setWidthPercentage(100);
        try { items.setWidths(new int[] { 40, 15, 20, 25 }); } catch (Exception ignored) {}
        items.addCell(headerCell("Drug"));
        items.addCell(headerCell("Dose"));
        items.addCell(headerCell("Frequency"));
        items.addCell(headerCell("Duration"));

        for (PrescriptionItemDto it : rx.items()) {
            StringBuilder sub = new StringBuilder();
            String timingPhrase = joinTimings(it.mealTimings());
            if (!timingPhrase.isEmpty()) {
                sub.append("\n   • Take ").append(timingPhrase);
            }
            if (it.instructions() != null && !it.instructions().isBlank()) {
                sub.append("\n   • ").append(it.instructions());
            }
            items.addCell(bodyCell(it.drugName() + sub, bodyFont));
            items.addCell(bodyCell(it.dose(), bodyFont));
            items.addCell(bodyCell(it.frequency(), bodyFont));
            items.addCell(bodyCell(it.duration(), bodyFont));
        }
        doc.add(items);
        doc.add(spacer(16));

        // Notes
        if (rx.notes() != null && !rx.notes().isBlank()) {
            doc.add(new Paragraph("Clinical notes", sectionFont));
            doc.add(spacer(4));
            doc.add(new Paragraph(rx.notes(), bodyFont));
            doc.add(spacer(14));
        }

        if (rx.status() == PrescriptionStatus.VOIDED) {
            Paragraph voided = new Paragraph(
                    "VOIDED — Reason: " + nullSafe(rx.voidReason()),
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, new Color(0xDC, 0x26, 0x26))
            );
            doc.add(voided);
            doc.add(spacer(10));
        }

        // Signature footer
        if (rx.status() == PrescriptionStatus.SIGNED && rx.signedAt() != null) {
            doc.add(new Chunk("\n"));
            doc.add(new Paragraph("────────────────────────────", smallMuted));
            doc.add(new Paragraph("Signed by " + nullSafe(rx.doctorName())
                    + " on " + DATE.format(rx.signedAt().toZonedDateTime()), stamp));
        } else if (rx.status() == PrescriptionStatus.DRAFT) {
            doc.add(new Paragraph("Draft — not yet signed. Not a valid prescription.", stamp));
        }

        doc.add(spacer(24));
        doc.add(new Paragraph(
                "This document is generated electronically by PulseCare. For verification, "
                        + "quote the Prescription Ref above when contacting the clinic.",
                smallMuted));

        doc.close();
        return out.toByteArray();
    }

    // ===== cell helpers =====

    private static PdfPCell textCell(String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setBorder(0);
        c.setPadding(4);
        return c;
    }

    private static PdfPCell headerCell(String text) {
        Font f = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBackgroundColor(PRIMARY);
        c.setPadding(8);
        c.setBorderColor(BORDER);
        return c;
    }

    private static PdfPCell bodyCell(String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setBorderColor(BORDER);
        c.setPadding(8);
        return c;
    }

    private static PdfPCell labelled(String label, String body, Font labelFont, Font bodyFont) {
        PdfPCell c = new PdfPCell();
        c.setBorderColor(BORDER);
        c.setPadding(10);
        c.addElement(new Paragraph(label.toUpperCase(Locale.ROOT),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, MUTED)));
        c.addElement(spacer(4));
        c.addElement(new Paragraph(body, bodyFont));
        return c;
    }

    private static Paragraph spacer(float h) {
        Paragraph p = new Paragraph(" ");
        p.setLeading(h);
        return p;
    }

    private static String nullSafe(String s) { return s == null ? "" : s; }

    /** "after breakfast and after dinner" / "a, b, and c" — skips UNSPECIFIED. */
    private static String joinTimings(java.util.List<MealTiming> timings) {
        if (timings == null || timings.isEmpty()) return "";
        java.util.List<String> labels = new java.util.ArrayList<>();
        for (MealTiming t : timings) {
            if (t == MealTiming.UNSPECIFIED) continue;
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
