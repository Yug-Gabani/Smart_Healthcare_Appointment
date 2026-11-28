package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.repository.PaymentOrderRepository;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Streams date-filtered audit reports as RFC-4180 CSV (with UTF-8 BOM for Excel)
 * in fixed-size chunks and clears the persistence context between pages so large
 * exports never exhaust JVM heap memory.
 */
@Service
public class AdminExportService {

    static final int EXPORT_CHUNK_SIZE = 200;

    private static final OffsetDateTime MIN_OFFSET_DATE =
            OffsetDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);
    private static final OffsetDateTime MAX_OFFSET_DATE =
            OffsetDateTime.of(2100, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);

    private final AppointmentRepository appointmentRepository;
    private final PaymentOrderRepository paymentOrderRepository;
    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorSlotRepository doctorSlotRepository;
    private final EntityManager entityManager;

    public AdminExportService(
            AppointmentRepository appointmentRepository,
            PaymentOrderRepository paymentOrderRepository,
            UserRepository userRepository,
            DoctorRepository doctorRepository,
            DoctorSlotRepository doctorSlotRepository,
            EntityManager entityManager) {
        this.appointmentRepository = appointmentRepository;
        this.paymentOrderRepository = paymentOrderRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.doctorSlotRepository = doctorSlotRepository;
        this.entityManager = entityManager;
    }

    public void validateDateRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BusinessRuleException("Start date cannot be after end date.");
        }
    }

    @Transactional(readOnly = true)
    public void streamAppointmentsCsv(
            LocalDate from,
            LocalDate to,
            AppointmentStatus status,
            Writer writer) throws IOException {
        validateDateRange(from, to);

        OffsetDateTime start = (from != null)
                ? from.atStartOfDay().atOffset(ZoneOffset.UTC)
                : MIN_OFFSET_DATE;
        OffsetDateTime end = (to != null)
                ? to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC).minusNanos(1)
                : MAX_OFFSET_DATE;

        // UTF-8 BOM for seamless Excel import
        writer.write('\uFEFF');
        writer.write("Appointment ID,Created At,Slot Time,Patient Name,Patient Email,Doctor Name,Specialty,Hospital,Mode,Urgency,Status,Fee (INR),Refund %,Refund Amount (INR),Cancellation Reason\r\n");
        writer.flush();

        int pageIdx = 0;
        Page<Appointment> page;
        do {
            Pageable pageable = PageRequest.of(pageIdx, EXPORT_CHUNK_SIZE, Sort.by(Sort.Direction.DESC, "createdAt"));
            page = (status != null)
                    ? appointmentRepository.findByCreatedAtBetweenAndStatus(start, end, status, pageable)
                    : appointmentRepository.findByCreatedAtBetween(start, end, pageable);

            List<Appointment> chunk = page.getContent();
            if (!chunk.isEmpty()) {
                writeAppointmentChunk(chunk, writer);
            }
            writer.flush();
            entityManager.clear();
            pageIdx++;
        } while (page.hasNext());
    }

    @Transactional(readOnly = true)
    public void streamTransactionsCsv(
            LocalDate from,
            LocalDate to,
            PaymentOrder.Status status,
            Writer writer) throws IOException {
        validateDateRange(from, to);

        Instant start = (from != null)
                ? from.atStartOfDay().toInstant(ZoneOffset.UTC)
                : MIN_OFFSET_DATE.toInstant();
        Instant end = (to != null)
                ? to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).minusNanos(1)
                : MAX_OFFSET_DATE.toInstant();

        // UTF-8 BOM for seamless Excel import
        writer.write('\uFEFF');
        writer.write("Order ID,Razorpay Order ID,Razorpay Payment ID,Appointment ID,Patient Name,Doctor Name,Amount (INR),Currency,Status,Refund Amount (INR),Refund Status,Created At\r\n");
        writer.flush();

        int pageIdx = 0;
        Page<PaymentOrder> page;
        do {
            Pageable pageable = PageRequest.of(pageIdx, EXPORT_CHUNK_SIZE, Sort.by(Sort.Direction.DESC, "createdAt"));
            page = (status != null)
                    ? paymentOrderRepository.findByCreatedAtBetweenAndStatus(start, end, status, pageable)
                    : paymentOrderRepository.findByCreatedAtBetween(start, end, pageable);

            List<PaymentOrder> chunk = page.getContent();
            if (!chunk.isEmpty()) {
                writeTransactionChunk(chunk, writer);
            }
            writer.flush();
            entityManager.clear();
            pageIdx++;
        } while (page.hasNext());
    }

    private void writeAppointmentChunk(List<Appointment> chunk, Writer writer) throws IOException {
        Set<UUID> patientIds = chunk.stream().map(Appointment::getPatientId).collect(Collectors.toSet());
        Set<UUID> doctorIds = chunk.stream().map(Appointment::getDoctorId).collect(Collectors.toSet());
        Set<UUID> slotIds = chunk.stream().map(Appointment::getSlotId).collect(Collectors.toSet());

        Map<UUID, User> userMap = userRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, Doctor> doctorMap = doctorRepository.findAllById(doctorIds).stream()
                .collect(Collectors.toMap(Doctor::getId, Function.identity()));
        Map<UUID, DoctorSlot> slotMap = doctorSlotRepository.findAllById(slotIds).stream()
                .collect(Collectors.toMap(DoctorSlot::getId, Function.identity()));

        for (Appointment a : chunk) {
            User p = userMap.get(a.getPatientId());
            Doctor d = doctorMap.get(a.getDoctorId());
            DoctorSlot slot = slotMap.get(a.getSlotId());
            long feeRupees = (d != null && d.getConsultationFee() != null)
                    ? d.getConsultationFee().longValue()
                    : 500L;

            StringBuilder line = new StringBuilder(256);
            line.append(csvCell(a.getId())).append(',')
                .append(csvCell(a.getCreatedAt())).append(',')
                .append(csvCell(slot != null ? slot.getSlotAt() : null)).append(',')
                .append(csvCell(p != null ? p.getFullName() : "Unknown Patient")).append(',')
                .append(csvCell(p != null ? p.getEmail() : "")).append(',')
                .append(csvCell(d != null ? d.getFullName() : "Unknown Doctor")).append(',')
                .append(csvCell(d != null && d.getSpecialty() != null ? d.getSpecialty() : "General")).append(',')
                .append(csvCell(d != null && d.getHospital() != null ? d.getHospital() : "")).append(',')
                .append(csvCell(a.getConsultationType() != null ? a.getConsultationType().name() : "IN_PERSON")).append(',')
                .append(csvCell(a.getUrgency() != null ? a.getUrgency().name() : "ROUTINE")).append(',')
                .append(csvCell(a.getStatus() != null ? a.getStatus().name() : "BOOKED")).append(',')
                .append(csvCell(feeRupees)).append(',')
                .append(csvCell(a.getRefundPercentage() != null ? a.getRefundPercentage() : "")).append(',')
                .append(csvCell(paiseToInr(a.getRefundAmountPaise()))).append(',')
                .append(csvCell(a.getCancellationReason()))
                .append("\r\n");
            writer.write(line.toString());
        }
    }

    private void writeTransactionChunk(List<PaymentOrder> chunk, Writer writer) throws IOException {
        Set<UUID> patientIds = chunk.stream().map(PaymentOrder::getPatientId).collect(Collectors.toSet());
        Set<UUID> doctorIds = chunk.stream().map(PaymentOrder::getDoctorId).collect(Collectors.toSet());

        Map<UUID, User> userMap = userRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, Doctor> doctorMap = doctorRepository.findAllById(doctorIds).stream()
                .collect(Collectors.toMap(Doctor::getId, Function.identity()));

        for (PaymentOrder o : chunk) {
            User p = userMap.get(o.getPatientId());
            Doctor d = doctorMap.get(o.getDoctorId());

            StringBuilder line = new StringBuilder(256);
            line.append(csvCell(o.getId())).append(',')
                .append(csvCell(o.getRazorpayOrderId())).append(',')
                .append(csvCell(o.getRazorpayPaymentId())).append(',')
                .append(csvCell(o.getAppointmentId())).append(',')
                .append(csvCell(p != null ? p.getFullName() : "Unknown Patient")).append(',')
                .append(csvCell(d != null ? d.getFullName() : "Unknown Doctor")).append(',')
                .append(csvCell(paiseToInr(o.getAmountPaise()))).append(',')
                .append(csvCell(o.getCurrency())).append(',')
                .append(csvCell(o.getStatus() != null ? o.getStatus().name() : "CREATED")).append(',')
                .append(csvCell(paiseToInr(o.getRefundAmountPaise()))).append(',')
                .append(csvCell(o.getRefundStatus())).append(',')
                .append(csvCell(o.getCreatedAt()))
                .append("\r\n");
            writer.write(line.toString());
        }
    }

    private static String paiseToInr(Long paise) {
        if (paise == null) return "";
        return BigDecimal.valueOf(paise)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                .toPlainString();
    }

    /**
     * Escapes a cell for RFC-4180 CSV and guards against spreadsheet formula injection.
     */
    static String csvCell(Object value) {
        if (value == null) {
            return "";
        }
        String raw = String.valueOf(value);
        if (!raw.isEmpty()) {
            char first = raw.charAt(0);
            boolean isNumericNegative = first == '-' && raw.matches("^-\\d+(?:\\.\\d+)?$");
            if (!isNumericNegative && (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r')) {
                raw = "'" + raw;
            }
        }
        boolean needsQuotes = raw.indexOf(',') >= 0 || raw.indexOf('"') >= 0
                || raw.indexOf('\n') >= 0 || raw.indexOf('\r') >= 0;
        if (!needsQuotes) {
            return raw;
        }
        return '"' + raw.replace("\"", "\"\"") + '"';
    }
}

