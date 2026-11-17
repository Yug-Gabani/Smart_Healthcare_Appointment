package com.group6.healthcare.clinic.service;

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

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AdminDashboardService {

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

