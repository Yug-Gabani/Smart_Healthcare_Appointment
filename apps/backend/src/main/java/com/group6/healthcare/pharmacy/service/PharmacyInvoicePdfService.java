package com.group6.healthcare.pharmacy.service;

import com.group6.healthcare.pharmacy.entity.PharmacyCommerceOrder;
import com.group6.healthcare.pharmacy.entity.PharmacyCommerceOrderItem;
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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Generates official Pharmacy Tax Invoices & Medical Insurance Receipts using OpenPDF.
 * Reflects itemized pharmaceutical purchases (HSN 3004), GST tax breakdown,
 * drug license credentials, and insurance reimbursement declarations.
 */
@Service
public class PharmacyInvoicePdfService {

    private static final Logger log = LoggerFactory.getLogger(PharmacyInvoicePdfService.class);

    private static final Color CYAN_BANNER     = new Color(14, 116, 144);  // #0E7490
    private static final Color DARK_SLATE      = new Color(30, 41, 59);    // #1E293B
    private static final Color MUTED_TEXT      = new Color(100, 116, 139); // #64748B
    private static final Color LIGHT_BG        = new Color(248, 250, 252); // #F8FAFC
    private static final Color BORDER_COLOR    = new Color(226, 232, 240); // #E2E8F0
    private static final Color GREEN_BADGE_BG  = new Color(220, 252, 231); // #DCFCE7
    private static final Color GREEN_BADGE_TXT = new Color(22, 101, 52);   // #166534

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a z").withZone(ZoneId.of("Asia/Kolkata"));

    public byte[] generateInvoicePdf(PharmacyCommerceOrder order) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // Standard A4 with 36pt margins for desktop and mobile reading fidelity
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, out);
            document.open();

            // Font hierarchy
            Font headerTitleFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 17, Color.WHITE);
            Font headerSubFont    = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(224, 242, 254));
            Font headerInvFont    = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE);

            Font sectionHeaderFont= FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, CYAN_BANNER);
            Font boldText         = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, DARK_SLATE);
            Font regularText      = FontFactory.getFont(FontFactory.HELVETICA, 9, DARK_SLATE);
            Font mutedTextFont    = FontFactory.getFont(FontFactory.HELVETICA, 8, MUTED_TEXT);
            Font statusBadgeFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, GREEN_BADGE_TXT);

            // 1. PHARMACY BANNER & HEADER
            PdfPTable headerTable = new PdfPTable(2);
            headerTable.setWidthPercentage(100);
            headerTable.setWidths(new float[]{65f, 35f});

            PdfPCell bannerLeft = new PdfPCell();
            bannerLeft.setBackgroundColor(CYAN_BANNER);
            bannerLeft.setPadding(14);
            bannerLeft.setBorder(0);
            Paragraph title = new Paragraph("🏥 PulseCare Pharmacy & Healthcare Supplies", headerTitleFont);
            Paragraph subTitle = new Paragraph("Official Outpatient Pharmacy Tax Invoice & Mediclaim Receipt", headerSubFont);
            subTitle.setSpacingBefore(2);
            Paragraph credentials = new Paragraph("Drug License: 20B/21B-MH-10294 • GSTIN: 27AABCP1234F1Z8", headerSubFont);
            credentials.setSpacingBefore(3);

            bannerLeft.addElement(title);
            bannerLeft.addElement(subTitle);
            bannerLeft.addElement(credentials);
            headerTable.addCell(bannerLeft);

            PdfPCell bannerRight = new PdfPCell();
            bannerRight.setBackgroundColor(CYAN_BANNER);
            bannerRight.setPadding(14);
            bannerRight.setBorder(0);
            bannerRight.setHorizontalAlignment(Element.ALIGN_RIGHT);

            String invNumber = "INV-PHARM-" + (order.getOrderNumber() != null ? order.getOrderNumber() : "GEN");
            Paragraph invNum = new Paragraph(invNumber, headerInvFont);
            invNum.setAlignment(Element.ALIGN_RIGHT);
            Paragraph regInfo = new Paragraph("Central Registered Pharmacy\nRegistered under D&C Act 1940", headerSubFont);
            regInfo.setAlignment(Element.ALIGN_RIGHT);
            regInfo.setSpacingBefore(3);

            bannerRight.addElement(invNum);
            bannerRight.addElement(regInfo);
            headerTable.addCell(bannerRight);

            document.add(headerTable);
            document.add(spacer(8));

            // 2. STATUS & SUMMARY STRIP
            PdfPTable statusBar = new PdfPTable(3);
            statusBar.setWidthPercentage(100);
            statusBar.setWidths(new float[]{36f, 34f, 30f});

            PdfPCell statusCell = new PdfPCell();
            statusCell.setBackgroundColor(GREEN_BADGE_BG);
            statusCell.setPadding(7);
            statusCell.setBorderColor(new Color(187, 247, 208));
            String payStatus = order.getPaymentStatus() != null ? order.getPaymentStatus().name() : "PAID";
            Paragraph badge = new Paragraph("● PAYMENT: " + payStatus + " / CONFIRMED", statusBadgeFont);
            statusCell.addElement(badge);
            statusBar.addCell(statusCell);

            PdfPCell dateCell = new PdfPCell();
            dateCell.setBackgroundColor(LIGHT_BG);
            dateCell.setPadding(7);
            dateCell.setBorderColor(BORDER_COLOR);
            String formattedDate = order.getCreatedAt() != null
                    ? DATE_FORMATTER.format(order.getCreatedAt().atZoneSameInstant(ZoneId.of("Asia/Kolkata")))
                    : "Confirmed";
            Paragraph dtText = new Paragraph("Date: " + formattedDate, regularText);
            dateCell.addElement(dtText);
            statusBar.addCell(dateCell);

            PdfPCell amountCell = new PdfPCell();
            amountCell.setBackgroundColor(LIGHT_BG);
            amountCell.setPadding(7);
            amountCell.setBorderColor(BORDER_COLOR);
            double totalRupees = (order.getTotalPaise() != null ? order.getTotalPaise() : 0L) / 100.0;
            String formattedTotal = String.format("Rs. %,.2f", totalRupees);
            Paragraph amtText = new Paragraph("Net Paid: " + formattedTotal, boldText);
            amtText.setAlignment(Element.ALIGN_RIGHT);
            amountCell.addElement(amtText);
            statusBar.addCell(amountCell);

            document.add(statusBar);
            document.add(spacer(10));

            // 3. TWO-COLUMN DELIVERY & DISPENSARY GRID
            PdfPTable gridTable = new PdfPTable(2);
            gridTable.setWidthPercentage(100);
            gridTable.setWidths(new float[]{50f, 50f});

            // Delivery Details
            PdfPCell deliveryCell = new PdfPCell();
            deliveryCell.setPadding(10);
            deliveryCell.setBackgroundColor(LIGHT_BG);
            deliveryCell.setBorderColor(BORDER_COLOR);

            Paragraph delHeader = new Paragraph("CUSTOMER & DELIVERY DESTINATION", sectionHeaderFont);
            delHeader.setSpacingAfter(4);
            deliveryCell.addElement(delHeader);

            deliveryCell.addElement(new Paragraph("Patient Name: " + nullSafe(order.getDeliveryName()), boldText));
            deliveryCell.addElement(new Paragraph("Phone: " + nullSafe(order.getDeliveryPhone()), regularText));
            String fullAddress = nullSafe(order.getDeliveryStreet()) + ", " + nullSafe(order.getDeliveryCity())
                    + ", " + nullSafe(order.getDeliveryState()) + " - " + nullSafe(order.getDeliveryPincode());
            deliveryCell.addElement(new Paragraph("Address: " + fullAddress, regularText));
            gridTable.addCell(deliveryCell);

            // Dispensary & Rx details
            PdfPCell dispensaryCell = new PdfPCell();
            dispensaryCell.setPadding(10);
            dispensaryCell.setBackgroundColor(LIGHT_BG);
            dispensaryCell.setBorderColor(BORDER_COLOR);

            Paragraph dispHeader = new Paragraph("DISPENSARY & PRESCRIPTION DETAILS", sectionHeaderFont);
            dispHeader.setSpacingAfter(4);
            dispensaryCell.addElement(dispHeader);

            dispensaryCell.addElement(new Paragraph("Fulfillment: PulseCare Central Outpatient Dispensary", boldText));
            String rxInfo = order.getPrescriptionId() != null
                    ? "Prescription Ref: " + order.getPrescriptionId().toString()
                    : "Prescription: Validated Outpatient Medication";
            dispensaryCell.addElement(new Paragraph(rxInfo, regularText));
            dispensaryCell.addElement(new Paragraph("Order Lifecycle: " + (order.getOrderStatus() != null ? order.getOrderStatus().name() : "PROCESSING"), regularText));
            gridTable.addCell(dispensaryCell);

            document.add(gridTable);
            document.add(spacer(10));

            // 4. ITEMIZED MEDICINE TABLE
            Paragraph itemHeading = new Paragraph("ITEMIZED MEDICINES & PHARMACEUTICAL CHARGES", sectionHeaderFont);
            document.add(itemHeading);
            document.add(spacer(4));

            PdfPTable itemTable = new PdfPTable(6);
            itemTable.setWidthPercentage(100);
            itemTable.setWidths(new float[]{6f, 44f, 14f, 10f, 13f, 13f});

            String[] headers = {"#", "Medicine / Drug Description", "HSN Code", "Qty", "Rate (INR)", "Total (INR)"};
            for (int i = 0; i < headers.length; i++) {
                PdfPCell hc = new PdfPCell(new Phrase(headers[i], FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE)));
                hc.setBackgroundColor(CYAN_BANNER);
                hc.setPadding(6);
                hc.setBorderColor(BORDER_COLOR);
                if (i == 0 || i == 3) hc.setHorizontalAlignment(Element.ALIGN_CENTER);
                if (i >= 4) hc.setHorizontalAlignment(Element.ALIGN_RIGHT);
                itemTable.addCell(hc);
            }

            List<PharmacyCommerceOrderItem> items = order.getItems();
            if (items != null) {
                int index = 1;
                for (PharmacyCommerceOrderItem item : items) {
                    Color bg = (index % 2 == 0) ? new Color(241, 245, 249) : Color.WHITE;

                    // #
                    PdfPCell cIdx = new PdfPCell(new Phrase(String.valueOf(index++), regularText));
                    cIdx.setBackgroundColor(bg);
                    cIdx.setPadding(6);
                    cIdx.setBorderColor(BORDER_COLOR);
                    cIdx.setHorizontalAlignment(Element.ALIGN_CENTER);
                    itemTable.addCell(cIdx);

                    // Name
                    PdfPCell cName = new PdfPCell(new Phrase(item.getMedicineName(), boldText));
                    cName.setBackgroundColor(bg);
                    cName.setPadding(6);
                    cName.setBorderColor(BORDER_COLOR);
                    itemTable.addCell(cName);

                    // HSN Code
                    PdfPCell cHsn = new PdfPCell(new Phrase("3004", regularText));
                    cHsn.setBackgroundColor(bg);
                    cHsn.setPadding(6);
                    cHsn.setBorderColor(BORDER_COLOR);
                    itemTable.addCell(cHsn);

                    // Qty
                    PdfPCell cQty = new PdfPCell(new Phrase(String.valueOf(item.getQuantity()), regularText));
                    cQty.setBackgroundColor(bg);
                    cQty.setPadding(6);
                    cQty.setBorderColor(BORDER_COLOR);
                    cQty.setHorizontalAlignment(Element.ALIGN_CENTER);
                    itemTable.addCell(cQty);

                    // Rate
                    String rate = String.format("Rs. %,.2f", (item.getUnitPricePaise() != null ? item.getUnitPricePaise() : 0L) / 100.0);
                    PdfPCell cRate = new PdfPCell(new Phrase(rate, regularText));
                    cRate.setBackgroundColor(bg);
                    cRate.setPadding(6);
                    cRate.setBorderColor(BORDER_COLOR);
                    cRate.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    itemTable.addCell(cRate);

                    // Total
                    long itemTotalPaise = (item.getUnitPricePaise() != null ? item.getUnitPricePaise() : 0L) * (item.getQuantity() != null ? item.getQuantity() : 1);
                    String total = String.format("Rs. %,.2f", itemTotalPaise / 100.0);
                    PdfPCell cTotal = new PdfPCell(new Phrase(total, boldText));
                    cTotal.setBackgroundColor(bg);
                    cTotal.setPadding(6);
                    cTotal.setBorderColor(BORDER_COLOR);
                    cTotal.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    itemTable.addCell(cTotal);
                }
            }

            document.add(itemTable);
            document.add(spacer(8));

            // 5. FINANCIAL & TAX / GST BREAKDOWN TABLE
            PdfPTable finTable = new PdfPTable(2);
            finTable.setWidthPercentage(50);
            finTable.setHorizontalAlignment(Element.ALIGN_RIGHT);
            finTable.setWidths(new float[]{60f, 40f});

            double subtotal = (order.getSubtotalPaise() != null ? order.getSubtotalPaise() : 0L) / 100.0;
            double discount = (order.getDiscountPaise() != null ? order.getDiscountPaise() : 0L) / 100.0;
            double delivery = (order.getDeliveryFeePaise() != null ? order.getDeliveryFeePaise() : 0L) / 100.0;
            double taxable = Math.max(0, subtotal - discount);
            // GST 5% inclusive on pharmaceuticals: CGST 2.5%, SGST 2.5%
            double cgst = (taxable * 0.025);
            double sgst = (taxable * 0.025);

            addFinancialRow(finTable, "Subtotal (MRP)", String.format("Rs. %,.2f", subtotal), false, regularText, boldText);
            if (discount > 0) {
                addFinancialRow(finTable, "Discounts & Savings", String.format("-Rs. %,.2f", discount), false, regularText, boldText);
            }
            addFinancialRow(finTable, "Delivery Charges", delivery == 0 ? "FREE" : String.format("Rs. %,.2f", delivery), false, regularText, boldText);
            addFinancialRow(finTable, "CGST (2.50% on Medicines)", String.format("Rs. %,.2f", cgst), false, mutedTextFont, mutedTextFont);
            addFinancialRow(finTable, "SGST (2.50% on Medicines)", String.format("Rs. %,.2f", sgst), false, mutedTextFont, mutedTextFont);
            addFinancialRow(finTable, "TOTAL AMOUNT PAID", formattedTotal, true, boldText, boldText);

            document.add(finTable);
            document.add(spacer(10));

            // 6. AUDIT PROVENANCE & MEDICLAIM INSURANCE REIMBURSEMENT
            PdfPTable auditTable = new PdfPTable(1);
            auditTable.setWidthPercentage(100);

            PdfPCell auditCell = new PdfPCell();
            auditCell.setPadding(10);
            auditCell.setBackgroundColor(LIGHT_BG);
            auditCell.setBorderColor(BORDER_COLOR);

            Paragraph auditHeader = new Paragraph("TAX INVOICE AUDIT PROVENANCE & INSURANCE REIMBURSEMENT", sectionHeaderFont);
            auditHeader.setSpacingAfter(4);
            auditCell.addElement(auditHeader);

            Paragraph txRef = new Paragraph(String.format("• Payment Ref: %s    • Gateway Order: %s",
                    order.getRazorpayPaymentId() != null ? order.getRazorpayPaymentId() : "pay_prepaid_gateway",
                    order.getRazorpayOrderId() != null ? order.getRazorpayOrderId() : "N/A"), regularText);
            Paragraph insuranceText = new Paragraph("• Insurance Reimbursement: This official tax invoice is valid for outpatient pharmacy claim reimbursement under corporate, group, and individual health insurance policies.", boldText);
            insuranceText.setSpacingBefore(2);
            Paragraph disclaimer = new Paragraph("Issued under Section 31 of the CGST Act 2017 & Information Technology Act 2000. Electronically generated valid medical invoice.", mutedTextFont);
            disclaimer.setSpacingBefore(4);

            auditCell.addElement(txRef);
            auditCell.addElement(insuranceText);
            auditCell.addElement(disclaimer);
            auditTable.addCell(auditCell);

            document.add(auditTable);

            document.close();
            log.info("Successfully generated pharmacy PDF tax invoice for order {}", order.getOrderNumber());
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed to generate pharmacy invoice PDF for order {}: {}", order.getOrderNumber(), ex.getMessage(), ex);
            throw new RuntimeException("Error generating pharmacy invoice PDF", ex);
        }
    }

    private void addFinancialRow(PdfPTable table, String label, String value, boolean isTotal, Font fLabel, Font fValue) {
        Color bg = isTotal ? new Color(241, 245, 249) : Color.WHITE;

        PdfPCell c1 = new PdfPCell(new Phrase(label, fLabel));
        c1.setBackgroundColor(bg);
        c1.setPadding(5);
        c1.setBorderColor(BORDER_COLOR);
        table.addCell(c1);

        PdfPCell c2 = new PdfPCell(new Phrase(value, fValue));
        c2.setBackgroundColor(bg);
        c2.setPadding(5);
        c2.setBorderColor(BORDER_COLOR);
        c2.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(c2);
    }

    private Paragraph spacer(float height) {
        Paragraph p = new Paragraph(" ");
        p.setLeading(height);
        return p;
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }
}
