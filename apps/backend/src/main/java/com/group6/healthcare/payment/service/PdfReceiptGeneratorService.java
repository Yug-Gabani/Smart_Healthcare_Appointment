package com.group6.healthcare.payment.service;

import com.group6.healthcare.payment.event.PaymentSuccessEvent;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.text.NumberFormat;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class PdfReceiptGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(PdfReceiptGeneratorService.class);

    private static final Color CYAN_BANNER = new Color(14, 116, 144);
    private static final Color DARK_SLATE = new Color(30, 41, 59);
    private static final Color MUTED_TEXT = new Color(100, 116, 139);
    private static final Color LIGHT_BG = new Color(248, 250, 252);
    private static final Color BORDER_COLOR = new Color(226, 232, 240);
    private static final Color GREEN_BADGE_BG = new Color(220, 252, 231);
    private static final Color GREEN_BADGE_TEXT = new Color(22, 101, 52);

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a").withZone(ZoneId.of("Asia/Kolkata"));

    public byte[] generateReceiptPdf(PaymentSuccessEvent event) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, out);
            document.open();

            // Font definitions
            Font headerTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.WHITE);
            Font headerSubFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(224, 242, 254));
            Font headerInvFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE);

            Font sectionHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, CYAN_BANNER);
            Font boldText = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, DARK_SLATE);
            Font regularText = FontFactory.getFont(FontFactory.HELVETICA, 10, DARK_SLATE);
            Font mutedTextFont = FontFactory.getFont(FontFactory.HELVETICA, 9, MUTED_TEXT);
            Font statusBadgeFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, GREEN_BADGE_TEXT);

            // 1. CYAN MEDICAL HEADER BANNER
            PdfPTable headerTable = new PdfPTable(2);
            headerTable.setWidthPercentage(100);
            headerTable.setWidths(new float[]{65f, 35f});

            PdfPCell bannerLeft = new PdfPCell();
            bannerLeft.setBackgroundColor(CYAN_BANNER);
            bannerLeft.setPadding(16);
            bannerLeft.setBorder(0);
            Paragraph title = new Paragraph("🏥 PulseCare Health Systems", headerTitleFont);
            Paragraph subTitle = new Paragraph("Official Consultation Invoice & Medical Tax Receipt", headerSubFont);
            subTitle.setSpacingBefore(3);
            bannerLeft.addElement(title);
            bannerLeft.addElement(subTitle);
            headerTable.addCell(bannerLeft);

            PdfPCell bannerRight = new PdfPCell();
            bannerRight.setBackgroundColor(CYAN_BANNER);
            bannerRight.setPadding(16);
            bannerRight.setBorder(0);
            bannerRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
            String invoiceId = "INV-" + (event.razorpayOrderId() != null ? event.razorpayOrderId().replace("order_", "") : "GEN");
            Paragraph invNum = new Paragraph(invoiceId, headerInvFont);
            invNum.setAlignment(Element.ALIGN_RIGHT);
            Paragraph orgGst = new Paragraph("GSTIN: 27AABCP1234F1Z8\nDigital Healthcare Services", headerSubFont);
            orgGst.setAlignment(Element.ALIGN_RIGHT);
            orgGst.setSpacingBefore(3);
            bannerRight.addElement(invNum);
            bannerRight.addElement(orgGst);
            headerTable.addCell(bannerRight);

            document.add(headerTable);

            // Spacing
            Paragraph spacer = new Paragraph(" ");
            spacer.setSpacingAfter(4);
            document.add(spacer);

            // 2. STATUS & SUMMARY BAR
            PdfPTable statusBar = new PdfPTable(3);
            statusBar.setWidthPercentage(100);
            statusBar.setWidths(new float[]{35f, 35f, 30f});

            PdfPCell statusCell = new PdfPCell();
            statusCell.setBackgroundColor(GREEN_BADGE_BG);
            statusCell.setPadding(8);
            statusCell.setBorderColor(new Color(187, 247, 208));
            Paragraph badge = new Paragraph("● PAYMENT VERIFIED / PAID", statusBadgeFont);
            statusCell.addElement(badge);
            statusBar.addCell(statusCell);

            PdfPCell dateCell = new PdfPCell();
            dateCell.setBackgroundColor(LIGHT_BG);
            dateCell.setPadding(8);
            dateCell.setBorderColor(BORDER_COLOR);
            String formattedDate = event.timestamp() != null ? DATE_FORMATTER.format(event.timestamp()) : "N/A";
            Paragraph dtText = new Paragraph("Confirmed: " + formattedDate, regularText);
            dateCell.addElement(dtText);
            statusBar.addCell(dateCell);

            PdfPCell amountCell = new PdfPCell();
            amountCell.setBackgroundColor(LIGHT_BG);
            amountCell.setPadding(8);
            amountCell.setBorderColor(BORDER_COLOR);
            String formattedAmount = String.format("Rs. %,.2f", event.amountPaise() / 100.0);
            Paragraph amtText = new Paragraph("Amount Paid: " + formattedAmount, boldText);
            amtText.setAlignment(Element.ALIGN_RIGHT);
            amountCell.addElement(amtText);
            statusBar.addCell(amountCell);

            document.add(statusBar);
            document.add(spacer);

            // 3. TWO-COLUMN DETAILS GRID (Patient on Left, Doctor & Slot on Right)
            PdfPTable gridTable = new PdfPTable(2);
            gridTable.setWidthPercentage(100);
            gridTable.setWidths(new float[]{50f, 50f});

            // Patient Info Cell
            PdfPCell patientCell = new PdfPCell();
            patientCell.setPadding(12);
            patientCell.setBackgroundColor(LIGHT_BG);
            patientCell.setBorderColor(BORDER_COLOR);

            Paragraph patientHeader = new Paragraph("PATIENT INFORMATION", sectionHeaderFont);
            patientHeader.setSpacingAfter(6);
            patientCell.addElement(patientHeader);

            patientCell.addElement(new Paragraph("Patient Name: " + (event.patientName() != null ? event.patientName() : "Patient"), boldText));
            patientCell.addElement(new Paragraph("Email: " + (event.userEmail() != null ? event.userEmail() : "N/A"), regularText));
            patientCell.addElement(new Paragraph("WhatsApp Phone: " + (event.phoneNumber() != null ? event.phoneNumber() : "N/A"), regularText));
            gridTable.addCell(patientCell);

            // Specialist Doctor & Slot Cell
            PdfPCell doctorCell = new PdfPCell();
            doctorCell.setPadding(12);
            doctorCell.setBackgroundColor(LIGHT_BG);
            doctorCell.setBorderColor(BORDER_COLOR);

            Paragraph doctorHeader = new Paragraph("CONSULTATION DETAILS", sectionHeaderFont);
            doctorHeader.setSpacingAfter(6);
            doctorCell.addElement(doctorHeader);

            doctorCell.addElement(new Paragraph("Consultant: " + (event.doctorName() != null ? event.doctorName() : "PulseCare Medical Specialist"), boldText));
            String slotStr = (event.slotTime() != null && !event.slotTime().isBlank()) ? event.slotTime() : "Today 02:00 PM";
            doctorCell.addElement(new Paragraph("Appointment Slot: " + slotStr, boldText));
            doctorCell.addElement(new Paragraph("Department: Telehealth & Clinical Outpatient", regularText));
            gridTable.addCell(doctorCell);

            document.add(gridTable);
            document.add(spacer);

            // 4. ITEMIZED FINANCIAL TABLE
            PdfPTable itemTable = new PdfPTable(4);
            itemTable.setWidthPercentage(100);
            itemTable.setWidths(new float[]{50f, 15f, 15f, 20f});

            // Table Headers
            String[] headers = {"Description", "Qty", "Rate (INR)", "Total (INR)"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, boldText));
                cell.setBackgroundColor(new Color(241, 245, 249));
                cell.setPadding(8);
                cell.setBorderColor(BORDER_COLOR);
                if (!h.equals("Description")) cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                itemTable.addCell(cell);
            }

            // Row 1: Doctor Consultation Fee
            addTableRow(itemTable, "Specialist Doctor Consultation & E-Prescription Review", "1", formattedAmount, formattedAmount, false);
            // Row 2: Digital Healthcare Platform & Gateway processing
            addTableRow(itemTable, "PulseCare Digital Platform & Gateway Processing Fee", "1", "Rs. 0.00", "Rs. 0.00 (Waived)", false);
            // Row 3: Healthcare Service Tax (Exempted)
            addTableRow(itemTable, "Healthcare Services Tax (GST Exempt Under Notif. 12/2017)", "—", "0.00%", "Rs. 0.00", false);
            // Row 4: Net Total
            addTableRow(itemTable, "NET AMOUNT PAID", "", "", formattedAmount, true);

            document.add(itemTable);
            document.add(spacer);

            // 5. AUDIT FOOTPRINT & PAYMENT TRANSACTION REFERENCE
            PdfPTable auditTable = new PdfPTable(1);
            auditTable.setWidthPercentage(100);

            PdfPCell auditCell = new PdfPCell();
            auditCell.setPadding(10);
            auditCell.setBackgroundColor(new Color(248, 250, 252));
            auditCell.setBorderColor(BORDER_COLOR);

            Paragraph auditHeader = new Paragraph("AUDIT FOOTPRINT & PAYMENT PROVENANCE", sectionHeaderFont);
            auditHeader.setSpacingAfter(4);
            auditCell.addElement(auditHeader);

            Paragraph audit1 = new Paragraph(String.format("• Razorpay Order ID: %s    • Razorpay Payment ID: %s",
                    event.razorpayOrderId() != null ? event.razorpayOrderId() : "N/A",
                    event.razorpayPaymentId() != null ? event.razorpayPaymentId() : "N/A"), regularText);
            Paragraph audit2 = new Paragraph(String.format("• Event Pipeline: Apache Kafka (%s)    • Currency: %s",
                    "payment-receipt-topic", event.currency() != null ? event.currency() : "INR"), mutedTextFont);
            Paragraph disclaimer = new Paragraph("This is an electronically generated official medical tax receipt issued by PulseCare Health Systems. In accordance with the IT Act 2000, no physical signature is required.", mutedTextFont);
            disclaimer.setSpacingBefore(6);

            auditCell.addElement(audit1);
            auditCell.addElement(audit2);
            auditCell.addElement(disclaimer);
            auditTable.addCell(auditCell);

            document.add(auditTable);

            document.close();
            log.info("Successfully generated medical PDF receipt for order {}", event.razorpayOrderId());
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed to generate PDF receipt for event {}: {}", event.razorpayOrderId(), ex.getMessage(), ex);
            throw new RuntimeException("Error generating receipt PDF", ex);
        }
    }

    private void addTableRow(PdfPTable table, String desc, String qty, String rate, String total, boolean isBold) {
        Font f = isBold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, DARK_SLATE)
                : FontFactory.getFont(FontFactory.HELVETICA, 9, DARK_SLATE);
        Color bg = isBold ? new Color(241, 245, 249) : Color.WHITE;

        PdfPCell c1 = new PdfPCell(new Phrase(desc, f));
        c1.setBackgroundColor(bg);
        c1.setPadding(7);
        c1.setBorderColor(BORDER_COLOR);
        table.addCell(c1);

        PdfPCell c2 = new PdfPCell(new Phrase(qty, f));
        c2.setBackgroundColor(bg);
        c2.setPadding(7);
        c2.setHorizontalAlignment(Element.ALIGN_RIGHT);
        c2.setBorderColor(BORDER_COLOR);
        table.addCell(c2);

        PdfPCell c3 = new PdfPCell(new Phrase(rate, f));
        c3.setBackgroundColor(bg);
        c3.setPadding(7);
        c3.setHorizontalAlignment(Element.ALIGN_RIGHT);
        c3.setBorderColor(BORDER_COLOR);
        table.addCell(c3);

        PdfPCell c4 = new PdfPCell(new Phrase(total, f));
        c4.setBackgroundColor(bg);
        c4.setPadding(7);
        c4.setHorizontalAlignment(Element.ALIGN_RIGHT);
        c4.setBorderColor(BORDER_COLOR);
        table.addCell(c4);
    }
}

