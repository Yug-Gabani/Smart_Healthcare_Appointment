package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.AdminAnalyticsResponse;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.entity.PaymentRefund;
import com.group6.healthcare.payment.repository.PaymentOrderRepository;
import com.group6.healthcare.payment.repository.PaymentRefundRepository;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AdminAnalyticsService {

    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorSlotRepository doctorSlotRepository;
    private final PaymentOrderRepository paymentOrderRepository;
    private final PaymentRefundRepository paymentRefundRepository;
    private final UserRepository userRepository;

    public AdminAnalyticsService(
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            DoctorSlotRepository doctorSlotRepository,
            PaymentOrderRepository paymentOrderRepository,
            PaymentRefundRepository paymentRefundRepository,
            UserRepository userRepository) {
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.doctorSlotRepository = doctorSlotRepository;
        this.paymentOrderRepository = paymentOrderRepository;
        this.paymentRefundRepository = paymentRefundRepository;
        this.userRepository = userRepository;
    }

    public AdminAnalyticsResponse getAnalytics() {
        List<Appointment> allAppointments = appointmentRepository.findAllByOrderByCreatedAtDesc();
        List<PaymentOrder> allOrders = paymentOrderRepository.findAllByOrderByCreatedAtDesc();
        List<PaymentRefund> allRefunds = paymentRefundRepository.findAll();

        // ── Monthly Revenue (last 6 months) ──────────────────────────────────
        Map<String, Long> revenueByMonth = new LinkedHashMap<>();
        Map<String, Long> refundByMonth = new LinkedHashMap<>();
        Map<String, Long> countByMonth = new LinkedHashMap<>();

        // Seed last 6 months so chart always shows them even with zero data
        DateTimeFormatter keyFmt = DateTimeFormatter.ofPattern("yyyy-MM");
        DateTimeFormatter labelFmt = DateTimeFormatter.ofPattern("MMM yyyy");
        OffsetDateTime now = OffsetDateTime.now();
        for (int i = 5; i >= 0; i--) {
            OffsetDateTime m = now.minusMonths(i);
            String key = m.format(keyFmt);
            revenueByMonth.put(key, 0L);
            refundByMonth.put(key, 0L);
            countByMonth.put(key, 0L);
        }

        for (PaymentOrder order : allOrders) {
            if (order.getCreatedAt() == null) continue;
            String key = order.getCreatedAt().atZone(ZoneOffset.UTC).format(keyFmt);
            if (!revenueByMonth.containsKey(key)) continue; // only last 6 months
            if (order.getStatus() == PaymentOrder.Status.PAID
                    || order.getStatus() == PaymentOrder.Status.PARTIALLY_REFUNDED) {
                revenueByMonth.merge(key, order.getAmountPaise(), Long::sum);
            }
        }

        for (PaymentRefund refund : allRefunds) {
            if (refund.getCreatedAt() == null) continue;
            String key = refund.getCreatedAt().atZone(ZoneOffset.UTC).format(keyFmt);
            if (!refundByMonth.containsKey(key)) continue;
            refundByMonth.merge(key, refund.getRefundAmountPaise(), Long::sum);
        }

        for (Appointment apt : allAppointments) {
            if (apt.getCreatedAt() == null) continue;
            String key = apt.getCreatedAt().format(keyFmt);
            if (!countByMonth.containsKey(key)) continue;
            countByMonth.merge(key, 1L, Long::sum);
        }

        List<AdminAnalyticsResponse.MonthlyRevenueDto> monthlyRevenue = revenueByMonth.entrySet().stream()
                .map(e -> {
                    String key = e.getKey();
                    long rev = e.getValue();
                    long ref = refundByMonth.getOrDefault(key, 0L);
                    long cnt = countByMonth.getOrDefault(key, 0L);
                    // Parse key back to get label
                    Instant dt = Instant.parse(key + "-01T00:00:00Z");
                    String label = dt.atZone(ZoneOffset.UTC).format(labelFmt);
                    return new AdminAnalyticsResponse.MonthlyRevenueDto(
                            key, label, rev, ref, rev - ref, cnt);
                })
                .toList();

        // ── Top Specialties ───────────────────────────────────────────────────
        Set<UUID> doctorIds = allAppointments.stream()
                .map(Appointment::getDoctorId).collect(Collectors.toSet());
        Map<UUID, Doctor> doctorMap = doctorRepository.findAllById(doctorIds).stream()
                .collect(Collectors.toMap(Doctor::getId, Function.identity()));

        Map<String, long[]> specialtyStats = new LinkedHashMap<>();
        for (Appointment apt : allAppointments) {
            Doctor doc = doctorMap.get(apt.getDoctorId());
            String specialty = doc != null && doc.getSpecialty() != null
                    ? doc.getSpecialty() : "General";
            specialtyStats.computeIfAbsent(specialty, k -> new long[]{0L, 0L});
            specialtyStats.get(specialty)[0]++;
        }

        // Add revenue per specialty from paid orders
        Map<UUID, Long> revenueByDoctorId = allOrders.stream()
                .filter(o -> o.getStatus() == PaymentOrder.Status.PAID
                        || o.getStatus() == PaymentOrder.Status.PARTIALLY_REFUNDED)
                .collect(Collectors.groupingBy(
                        PaymentOrder::getDoctorId,
                        Collectors.summingLong(PaymentOrder::getAmountPaise)));
        for (Map.Entry<UUID, Long> entry : revenueByDoctorId.entrySet()) {
            Doctor doc = doctorMap.get(entry.getKey());
            if (doc == null) continue;
            String specialty = doc.getSpecialty() != null ? doc.getSpecialty() : "General";
            long[] stats = specialtyStats.computeIfAbsent(specialty, k -> new long[]{0L, 0L});
            stats[1] += entry.getValue();
        }

        List<AdminAnalyticsResponse.SpecialtyBreakdownDto> topSpecialties = specialtyStats.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue()[0], a.getValue()[0]))
                .limit(6)
                .map(e -> new AdminAnalyticsResponse.SpecialtyBreakdownDto(
                        e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList();

        // ── Cancellation Metrics ──────────────────────────────────────────────
        long totalApts = allAppointments.size();
        long cancelled = allAppointments.stream()
                .filter(a -> a.getStatus() == AppointmentStatus.CANCELLED).count();
        long noShow = allAppointments.stream()
                .filter(a -> a.getStatus() == AppointmentStatus.NO_SHOW).count();
        double cancelRate = totalApts > 0 ? (cancelled * 100.0) / totalApts : 0.0;
        double noShowRate = totalApts > 0 ? (noShow * 100.0) / totalApts : 0.0;

        AdminAnalyticsResponse.CancellationMetricsDto cancellationMetrics =
                new AdminAnalyticsResponse.CancellationMetricsDto(
                        totalApts, cancelled, noShow,
                        Math.round(cancelRate * 10.0) / 10.0,
                        Math.round(noShowRate * 10.0) / 10.0);

        return new AdminAnalyticsResponse(monthlyRevenue, topSpecialties, cancellationMetrics);
    }

    // ── Streaming CSV Exports (no JVM OOM) ───────────────────────────────────

    /**
     * Streams all appointments as CSV using StreamingResponseBody so the JVM
     * never loads the full dataset into a single string/byte[].
     * Optional date filter: startDate / endDate are ISO date strings (yyyy-MM-dd).
     */
    public StreamingResponseBody streamAppointmentsCsv(
            String startDate, String endDate) {

        final OffsetDateTime from = startDate != null && !startDate.isBlank()
                ? OffsetDateTime.parse(startDate + "T00:00:00+00:00") : null;
        final OffsetDateTime to = endDate != null && !endDate.isBlank()
                ? OffsetDateTime.parse(endDate + "T23:59:59+00:00") : null;

        return outputStream -> {
            List<Appointment> all = appointmentRepository.findAllByOrderByCreatedAtDesc();

            Set<UUID> pIds = all.stream().map(Appointment::getPatientId).collect(Collectors.toSet());
            Set<UUID> dIds = all.stream().map(Appointment::getDoctorId).collect(Collectors.toSet());
            Set<UUID> sIds = all.stream().map(Appointment::getSlotId).collect(Collectors.toSet());

            Map<UUID, User> userMap = userRepository.findAllById(pIds).stream()
                    .collect(Collectors.toMap(User::getId, Function.identity()));
            Map<UUID, Doctor> doctorMap2 = doctorRepository.findAllById(dIds).stream()
                    .collect(Collectors.toMap(Doctor::getId, Function.identity()));
            Map<UUID, DoctorSlot> slotMap = doctorSlotRepository.findAllById(sIds).stream()
                    .collect(Collectors.toMap(DoctorSlot::getId, Function.identity()));

            try (PrintWriter w = new PrintWriter(
                    new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
                // BOM for Excel UTF-8 recognition
                w.print('\uFEFF');
                w.println("ID,Patient Name,Patient Email,Doctor Name,Specialty,Hospital," +
                        "Consultation Type,Status,Urgency,Slot Date,Fee (₹)," +
                        "Cancellation Reason,Created At");

                for (Appointment a : all) {
                    if (from != null && a.getCreatedAt() != null && a.getCreatedAt().isBefore(from)) continue;
                    if (to != null && a.getCreatedAt() != null && a.getCreatedAt().isAfter(to)) continue;

                    User p = userMap.get(a.getPatientId());
                    Doctor d = doctorMap2.get(a.getDoctorId());
                    DoctorSlot slot = slotMap.get(a.getSlotId());
                    long fee = d != null && d.getConsultationFee() != null
                            ? d.getConsultationFee().longValue() : 0L;

                    w.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%d,%s,%s%n",
                            csv(a.getId()),
                            csv(p != null ? p.getFullName() : ""),
                            csv(p != null ? p.getEmail() : ""),
                            csv(d != null ? d.getFullName() : ""),
                            csv(d != null ? d.getSpecialty() : ""),
                            csv(d != null ? d.getHospital() : ""),
                            csv(a.getConsultationType() != null ? a.getConsultationType().name() : ""),
                            csv(a.getStatus() != null ? a.getStatus().name() : ""),
                            csv(a.getUrgency() != null ? a.getUrgency().name() : ""),
                            csv(slot != null && slot.getSlotAt() != null
                                    ? slot.getSlotAt().toString() : ""),
                            fee,
                            csv(a.getCancellationReason()),
                            csv(a.getCreatedAt() != null ? a.getCreatedAt().toString() : ""));
                }
                w.flush();
            }
        };
    }

    /**
     * Streams all payment transactions as CSV using StreamingResponseBody.
     */
    public StreamingResponseBody streamPaymentsCsv(String startDate, String endDate) {

        // PaymentOrder.createdAt is Instant
        final Instant from = startDate != null && !startDate.isBlank()
                ? Instant.parse(startDate + "T00:00:00Z") : null;
        final Instant to = endDate != null && !endDate.isBlank()
                ? Instant.parse(endDate + "T23:59:59Z") : null;

        return outputStream -> {
            List<PaymentOrder> orders = paymentOrderRepository.findAllByOrderByCreatedAtDesc();

            Set<UUID> pIds = orders.stream().map(PaymentOrder::getPatientId).collect(Collectors.toSet());
            Set<UUID> dIds = orders.stream().map(PaymentOrder::getDoctorId).collect(Collectors.toSet());

            Map<UUID, User> userMap = userRepository.findAllById(pIds).stream()
                    .collect(Collectors.toMap(User::getId, Function.identity()));
            Map<UUID, Doctor> doctorMap2 = doctorRepository.findAllById(dIds).stream()
                    .collect(Collectors.toMap(Doctor::getId, Function.identity()));

            try (PrintWriter w = new PrintWriter(
                    new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
                w.print('\uFEFF');
                w.println("Order ID,Razorpay Order ID,Razorpay Payment ID," +
                        "Patient Name,Patient Email,Doctor Name,Appointment ID," +
                        "Amount (₹),Status,Created At");

                for (PaymentOrder o : orders) {
                    if (from != null && o.getCreatedAt() != null && o.getCreatedAt().isBefore(from)) continue;
                    if (to != null && o.getCreatedAt() != null && o.getCreatedAt().isAfter(to)) continue;

                    User p = userMap.get(o.getPatientId());
                    Doctor d = doctorMap2.get(o.getDoctorId());

                    w.printf("%s,%s,%s,%s,%s,%s,%s,%.2f,%s,%s%n",
                            csv(o.getId()),
                            csv(o.getRazorpayOrderId()),
                            csv(o.getRazorpayPaymentId()),
                            csv(p != null ? p.getFullName() : ""),
                            csv(p != null ? p.getEmail() : ""),
                            csv(d != null ? d.getFullName() : ""),
                            csv(o.getAppointmentId()),
                            o.getAmountPaise() / 100.0,
                            csv(o.getStatus() != null ? o.getStatus().name() : ""),
                            csv(o.getCreatedAt() != null ? o.getCreatedAt().toString() : ""));
                }
                w.flush();
            }
        };
    }

    /** Escape a value for CSV: wraps in quotes and doubles any internal quotes. */
    private static String csv(Object val) {
        if (val == null) return "";
        String s = val.toString().replace("\"", "\"\"");
        return s.contains(",") || s.contains("\"") || s.contains("\n")
                ? "\"" + s + "\"" : s;
    }
}
