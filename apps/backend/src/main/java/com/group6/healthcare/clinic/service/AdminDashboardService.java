package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.AdminAnalyticsResponse;
import com.group6.healthcare.clinic.dto.AdminAppointmentItemResponse;
import com.group6.healthcare.clinic.dto.AdminOverviewResponse;
import com.group6.healthcare.clinic.dto.AdminPaymentItemResponse;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.repository.HospitalRepository;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.entity.PaymentOutbox;
import com.group6.healthcare.payment.entity.PaymentRefund;
import com.group6.healthcare.payment.repository.PaymentOrderRepository;
import com.group6.healthcare.payment.repository.PaymentOutboxRepository;
import com.group6.healthcare.payment.repository.PaymentRefundRepository;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AdminDashboardService {

    private static final DateTimeFormatter MONTH_LABEL_FMT =
            DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH);

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorSlotRepository doctorSlotRepository;
    private final HospitalRepository hospitalRepository;
    private final PaymentOrderRepository paymentOrderRepository;
    private final PaymentRefundRepository paymentRefundRepository;
    private final PaymentOutboxRepository paymentOutboxRepository;

    public AdminDashboardService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            AppointmentRepository appointmentRepository,
            DoctorSlotRepository doctorSlotRepository,
            HospitalRepository hospitalRepository,
            PaymentOrderRepository paymentOrderRepository,
            PaymentRefundRepository paymentRefundRepository,
            PaymentOutboxRepository paymentOutboxRepository) {
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.doctorSlotRepository = doctorSlotRepository;
        this.hospitalRepository = hospitalRepository;
        this.paymentOrderRepository = paymentOrderRepository;
        this.paymentRefundRepository = paymentRefundRepository;
        this.paymentOutboxRepository = paymentOutboxRepository;
    }

    public AdminOverviewResponse getOverview() {
        // Counts
        long totalDoctors = doctorRepository.count();
        long approvedDoctors = doctorRepository.countByStatus(DoctorStatus.APPROVED);
        long pendingDoctors = doctorRepository.countByStatus(DoctorStatus.PENDING);
        long rejectedDoctors = doctorRepository.countByStatus(DoctorStatus.REJECTED);
        long suspendedDoctors = doctorRepository.countByStatus(DoctorStatus.SUSPENDED);
        long totalPatients = userRepository.countByRole(Role.PATIENT);

        long totalAppointments = appointmentRepository.count();
        long bookedAppointments = appointmentRepository.countByStatus(AppointmentStatus.BOOKED);
        long completedAppointments = appointmentRepository.countByStatus(AppointmentStatus.COMPLETED);
        long cancelledAppointments = appointmentRepository.countByStatus(AppointmentStatus.CANCELLED);
        long totalHospitals = hospitalRepository.count();

        // Revenue & refunds calculation
        List<PaymentOrder> orders = paymentOrderRepository.findAll();
        long totalRevenuePaise = orders.stream()
                .filter(o -> o.getStatus() == PaymentOrder.Status.PAID || o.getStatus() == PaymentOrder.Status.PARTIALLY_REFUNDED)
                .mapToLong(PaymentOrder::getAmountPaise)
                .sum();

        List<PaymentRefund> refunds = paymentRefundRepository.findAll();
        long totalRefundPaise = refunds.stream()
                .mapToLong(PaymentRefund::getRefundAmountPaise)
                .sum();

        AdminOverviewResponse.AdminStats stats = new AdminOverviewResponse.AdminStats(
                totalDoctors,
                approvedDoctors,
                pendingDoctors,
                rejectedDoctors,
                suspendedDoctors,
                totalPatients,
                totalAppointments,
                bookedAppointments,
                completedAppointments,
                cancelledAppointments,
                totalRevenuePaise,
                totalRefundPaise,
                totalHospitals
        );

        // Recent Consultations
        List<Appointment> recentAppointments = appointmentRepository.findAllByOrderByCreatedAtDesc();
        List<Appointment> topRecent = recentAppointments.stream().limit(6).toList();

        Set<UUID> patientIds = topRecent.stream().map(Appointment::getPatientId).collect(Collectors.toSet());
        Set<UUID> doctorIds = topRecent.stream().map(Appointment::getDoctorId).collect(Collectors.toSet());
        Set<UUID> slotIds = topRecent.stream().map(Appointment::getSlotId).collect(Collectors.toSet());

        Map<UUID, User> userMap = userRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, Doctor> doctorMap = doctorRepository.findAllById(doctorIds).stream()
                .collect(Collectors.toMap(Doctor::getId, Function.identity()));
        Map<UUID, DoctorSlot> slotMap = doctorSlotRepository.findAllById(slotIds).stream()
                .collect(Collectors.toMap(DoctorSlot::getId, Function.identity()));

        List<AdminOverviewResponse.RecentConsultationDto> recentConsultationDtos = topRecent.stream().map(a -> {
            User p = userMap.get(a.getPatientId());
            Doctor d = doctorMap.get(a.getDoctorId());
            DoctorSlot slot = slotMap.get(a.getSlotId());

            return new AdminOverviewResponse.RecentConsultationDto(
                    a.getId(),
                    p != null ? p.getFullName() : "Unknown Patient",
                    p != null ? p.getEmail() : null,
                    d != null ? d.getFullName() : "Unknown Doctor",
                    d != null ? d.getSpecialty() : null,
                    a.getConsultationType() != null ? a.getConsultationType().name() : "IN_PERSON",
                    a.getStatus() != null ? a.getStatus().name() : "BOOKED",
                    a.getUrgency() != null ? a.getUrgency().name() : "ROUTINE",
                    slot != null ? slot.getSlotAt() : null,
                    d != null && d.getConsultationFee() != null ? d.getConsultationFee().longValue() : 500L,
                    a.getCreatedAt()
            );
        }).toList();

        // Pending doctors
        List<Doctor> pendingDoctorList = doctorRepository.findByStatus(DoctorStatus.PENDING);
        List<AdminOverviewResponse.PendingDoctorDto> pendingDoctorDtos = pendingDoctorList.stream().limit(4).map(d ->
                new AdminOverviewResponse.PendingDoctorDto(
                        d.getId(),
                        d.getFullName(),
                        d.getSpecialty(),
                        d.getHospital(),
                        d.getRegistrationNumber(),
                        d.getYearsExperience(),
                        d.getSubmittedAt()
                )
        ).toList();

        // System Health
        long outboxPending = paymentOutboxRepository.countByStatus(PaymentOutbox.Status.PENDING);
        AdminOverviewResponse.SystemHealthDto systemHealth = new AdminOverviewResponse.SystemHealthDto(
                "UP",
                totalHospitals,
                outboxPending,
                "OPERATIONAL"
        );

        return new AdminOverviewResponse(stats, recentConsultationDtos, pendingDoctorDtos, systemHealth);
    }

    public AdminAnalyticsResponse getAnalytics(int months) {
        int windowMonths = Math.max(1, Math.min(months, 24));
        YearMonth currentMonth = YearMonth.now(ZoneOffset.UTC);

        // Pre-populate all months in the window so charts have a continuous timeline
        Map<YearMonth, long[]> monthlyBuckets = new LinkedHashMap<>();
        for (int i = windowMonths - 1; i >= 0; i--) {
            // [0] = revenuePaise, [1] = refundPaise, [2] = transactionCount
            monthlyBuckets.put(currentMonth.minusMonths(i), new long[]{0L, 0L, 0L});
        }

        List<PaymentOrder> orders = paymentOrderRepository.findAll();
        Map<UUID, Long> doctorRevenueMap = new HashMap<>();

        for (PaymentOrder order : orders) {
            boolean countsAsRevenue = order.getStatus() == PaymentOrder.Status.PAID
                    || order.getStatus() == PaymentOrder.Status.PARTIALLY_REFUNDED;
            if (countsAsRevenue && order.getAmountPaise() != null) {
                doctorRevenueMap.merge(order.getDoctorId(), order.getAmountPaise(), Long::sum);
                if (order.getCreatedAt() != null) {
                    YearMonth ym = YearMonth.from(order.getCreatedAt().atOffset(ZoneOffset.UTC));
                    long[] bucket = monthlyBuckets.get(ym);
                    if (bucket != null) {
                        bucket[0] += order.getAmountPaise();
                        bucket[2] += 1L;
                    }
                }
            }
        }

        List<PaymentRefund> refunds = paymentRefundRepository.findAll();
        for (PaymentRefund refund : refunds) {
            if (refund.getCreatedAt() != null && refund.getRefundAmountPaise() != null) {
                YearMonth ym = YearMonth.from(refund.getCreatedAt().atOffset(ZoneOffset.UTC));
                long[] bucket = monthlyBuckets.get(ym);
                if (bucket != null) {
                    bucket[1] += refund.getRefundAmountPaise();
                }
            }
        }

        List<AdminAnalyticsResponse.MonthlyRevenuePoint> monthlyRevenue = new ArrayList<>();
        for (Map.Entry<YearMonth, long[]> entry : monthlyBuckets.entrySet()) {
            YearMonth ym = entry.getKey();
            long[] vals = entry.getValue();
            long rev = vals[0];
            long ref = vals[1];
            monthlyRevenue.add(new AdminAnalyticsResponse.MonthlyRevenuePoint(
                    ym.toString(),
                    ym.format(MONTH_LABEL_FMT),
                    rev,
                    ref,
                    Math.max(0L, rev - ref),
                    vals[2]
            ));
        }

        // Specialty breakdown & cancellation/no-show metrics
        List<Appointment> appointments = appointmentRepository.findAll();
        Map<UUID, Doctor> doctorMap = doctorRepository.findAll().stream()
                .collect(Collectors.toMap(Doctor::getId, Function.identity()));

        // Map doctor-level revenue into specialty totals (once per doctor)
        Map<String, Long> specialtyRevenue = new HashMap<>();
        for (Map.Entry<UUID, Long> e : doctorRevenueMap.entrySet()) {
            Doctor doc = doctorMap.get(e.getKey());
            String spec = (doc != null && doc.getSpecialty() != null && !doc.getSpecialty().isBlank())
                    ? doc.getSpecialty().trim()
                    : "General";
            specialtyRevenue.merge(spec, e.getValue(), Long::sum);
        }

        // [0] total, [1] completed, [2] cancelled, [3] noShow
        Map<String, long[]> specialtyCounts = new HashMap<>();
        long completedCount = 0;
        long cancelledCount = 0;
        long noShowCount = 0;
        long bookedCount = 0;
        long confirmedCount = 0;
        long expiredCount = 0;

        for (Appointment appt : appointments) {
            Doctor doc = doctorMap.get(appt.getDoctorId());
            String spec = (doc != null && doc.getSpecialty() != null && !doc.getSpecialty().isBlank())
                    ? doc.getSpecialty().trim()
                    : "General";
            long[] counts = specialtyCounts.computeIfAbsent(spec, k -> new long[]{0L, 0L, 0L, 0L});
            counts[0]++;

            AppointmentStatus status = appt.getStatus();
            if (status == AppointmentStatus.COMPLETED) {
                completedCount++;
                counts[1]++;
            } else if (status == AppointmentStatus.CANCELLED) {
                cancelledCount++;
                counts[2]++;
            } else if (status == AppointmentStatus.NO_SHOW) {
                noShowCount++;
                counts[3]++;
            } else if (status == AppointmentStatus.BOOKED) {
                bookedCount++;
            } else if (status == AppointmentStatus.CONFIRMED) {
                confirmedCount++;
            } else if (status == AppointmentStatus.EXPIRED) {
                expiredCount++;
            }
        }

        List<AdminAnalyticsResponse.SpecialtyMetric> topSpecialties = specialtyCounts.entrySet().stream()
                .map(e -> {
                    String spec = e.getKey();
                    long[] c = e.getValue();
                    return new AdminAnalyticsResponse.SpecialtyMetric(
                            spec,
                            c[0],
                            c[1],
                            c[2],
                            c[3],
                            specialtyRevenue.getOrDefault(spec, 0L)
                    );
                })
                .sorted(Comparator.comparingLong(AdminAnalyticsResponse.SpecialtyMetric::appointmentCount).reversed()
                        .thenComparing(Comparator.comparingLong(AdminAnalyticsResponse.SpecialtyMetric::revenuePaise).reversed()))
                .limit(8)
                .toList();

        long totalAppts = appointments.size();
        AdminAnalyticsResponse.CancellationMetrics cancellationMetrics = new AdminAnalyticsResponse.CancellationMetrics(
                totalAppts,
                completedCount,
                cancelledCount,
                noShowCount,
                bookedCount,
                confirmedCount,
                expiredCount,
                roundPct(completedCount, totalAppts),
                roundPct(cancelledCount, totalAppts),
                roundPct(noShowCount, totalAppts)
        );

        return new AdminAnalyticsResponse(monthlyRevenue, topSpecialties, cancellationMetrics);
    }

    private double roundPct(long part, long total) {
        if (total <= 0) return 0.0;
        return Math.round((part * 1000.0) / total) / 10.0;
    }

    public List<AdminAppointmentItemResponse> getAllAppointments() {
        List<Appointment> all = appointmentRepository.findAllByOrderByCreatedAtDesc();

        Set<UUID> patientIds = all.stream().map(Appointment::getPatientId).collect(Collectors.toSet());
        Set<UUID> doctorIds = all.stream().map(Appointment::getDoctorId).collect(Collectors.toSet());
        Set<UUID> slotIds = all.stream().map(Appointment::getSlotId).collect(Collectors.toSet());

        Map<UUID, User> userMap = userRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, Doctor> doctorMap = doctorRepository.findAllById(doctorIds).stream()
                .collect(Collectors.toMap(Doctor::getId, Function.identity()));
        Map<UUID, DoctorSlot> slotMap = doctorSlotRepository.findAllById(slotIds).stream()
                .collect(Collectors.toMap(DoctorSlot::getId, Function.identity()));

        return all.stream().map(a -> {
            User p = userMap.get(a.getPatientId());
            Doctor d = doctorMap.get(a.getDoctorId());
            DoctorSlot slot = slotMap.get(a.getSlotId());

            return new AdminAppointmentItemResponse(
                    a.getId(),
                    a.getPatientId(),
                    p != null ? p.getFullName() : "Patient (" + a.getPatientId() + ")",
                    p != null ? p.getEmail() : "—",
                    a.getDoctorId(),
                    d != null ? d.getFullName() : "Doctor (" + a.getDoctorId() + ")",
                    d != null ? d.getSpecialty() : "General",
                    d != null ? d.getHospital() : "—",
                    a.getConsultationType() != null ? a.getConsultationType().name() : "IN_PERSON",
                    a.getStatus() != null ? a.getStatus().name() : "BOOKED",
                    a.getUrgency() != null ? a.getUrgency().name() : "ROUTINE",
                    a.getChiefComplaint(),
                    slot != null ? slot.getSlotAt() : null,
                    d != null && d.getConsultationFee() != null ? d.getConsultationFee().longValue() : 500L,
                    a.getRefundPercentage(),
                    a.getRefundAmountPaise(),
                    a.getCancellationReason(),
                    a.getCreatedAt()
            );
        }).toList();
    }

    public List<AdminPaymentItemResponse> getAllPayments() {
        List<PaymentOrder> orders = paymentOrderRepository.findAllByOrderByCreatedAtDesc();

        Set<UUID> patientIds = orders.stream().map(PaymentOrder::getPatientId).collect(Collectors.toSet());
        Set<UUID> doctorIds = orders.stream().map(PaymentOrder::getDoctorId).collect(Collectors.toSet());

        Map<UUID, User> userMap = userRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, Doctor> doctorMap = doctorRepository.findAllById(doctorIds).stream()
                .collect(Collectors.toMap(Doctor::getId, Function.identity()));

        return orders.stream().map(o -> {
            User p = userMap.get(o.getPatientId());
            Doctor d = doctorMap.get(o.getDoctorId());

            return new AdminPaymentItemResponse(
                    o.getId(),
                    o.getRazorpayOrderId(),
                    o.getRazorpayPaymentId(),
                    o.getPatientId(),
                    p != null ? p.getFullName() : "Patient (" + o.getPatientId() + ")",
                    o.getDoctorId(),
                    d != null ? d.getFullName() : "Doctor (" + o.getDoctorId() + ")",
                    o.getAppointmentId(),
                    o.getAmountPaise(),
                    o.getStatus() != null ? o.getStatus().name() : "CREATED",
                    o.getCreatedAt()
            );
        }).toList();
    }
}
