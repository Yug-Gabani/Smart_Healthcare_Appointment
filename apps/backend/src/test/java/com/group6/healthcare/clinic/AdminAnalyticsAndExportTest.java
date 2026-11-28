package com.group6.healthcare.clinic;

import com.group6.healthcare.auth.service.JwtService;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.AppointmentStatus;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.DoctorStatus;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.payment.entity.PaymentOrder;
import com.group6.healthcare.payment.entity.PaymentRefund;
import com.group6.healthcare.payment.repository.PaymentOrderRepository;
import com.group6.healthcare.payment.repository.PaymentRefundRepository;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAnalyticsAndExportTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserRepository userRepository;
    @Autowired DoctorRepository doctorRepository;
    @Autowired DoctorSlotRepository slotRepository;
    @Autowired AppointmentRepository appointmentRepository;
    @Autowired PaymentOrderRepository paymentOrderRepository;
    @Autowired PaymentRefundRepository paymentRefundRepository;

    private String adminToken;
    private String patientToken;
    private User patientUser;
    private Doctor cardiologyDoctor;
    private Doctor neurologyDoctor;

    @BeforeEach
    void setUp() {
        paymentRefundRepository.deleteAll();
        paymentOrderRepository.deleteAll();
        appointmentRepository.deleteAll();
        slotRepository.deleteAll();
        doctorRepository.deleteAll();
        userRepository.deleteAll();

        User adminUser = userRepository.save(User.builder()
                .email("admin.analytics@test.local")
                .passwordHash(passwordEncoder.encode("AdminPass#123"))
                .fullName("Admin User")
                .role(Role.ADMIN)
                .enabled(true)
                .build());
        adminToken = jwtService.generateAccessToken(adminUser);

        patientUser = userRepository.save(User.builder()
                .email("patient.analytics@test.local")
                .passwordHash(passwordEncoder.encode("PatientPass#123"))
                .fullName("=SUM(A1:A2) Patient")
                .role(Role.PATIENT)
                .enabled(true)
                .build());
        patientToken = jwtService.generateAccessToken(patientUser);

        User doc1User = userRepository.save(User.builder()
                .email("cardio@test.local")
                .passwordHash(passwordEncoder.encode("DocPass#123"))
                .fullName("Dr. Cardio")
                .role(Role.DOCTOR)
                .enabled(true)
                .build());
        cardiologyDoctor = doctorRepository.save(Doctor.builder()
                .userId(doc1User.getId())
                .fullName("Dr. Cardio")
                .specialty("Cardiology")
                .hospital("Apollo Hospital")
                .consultationFee(new BigDecimal("800.00"))
                .status(DoctorStatus.APPROVED)
                .rating(new BigDecimal("4.8"))
                .build());

        User doc2User = userRepository.save(User.builder()
                .email("neuro@test.local")
                .passwordHash(passwordEncoder.encode("DocPass#123"))
                .fullName("Dr. Neuro")
                .role(Role.DOCTOR)
                .enabled(true)
                .build());
        neurologyDoctor = doctorRepository.save(Doctor.builder()
                .userId(doc2User.getId())
                .fullName("Dr. Neuro")
                .specialty("Neurology")
                .hospital("Fortis Clinic")
                .consultationFee(new BigDecimal("1000.00"))
                .status(DoctorStatus.APPROVED)
                .rating(new BigDecimal("4.7"))
                .build());
    }

    @Test
    @DisplayName("Analytics & CSV export endpoints reject non-admin users with 403 Forbidden")
    void nonAdminForbidden() throws Exception {
        mvc.perform(get("/api/v1/admin/analytics")
                        .header("Authorization", "Bearer " + patientToken))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/admin/exports/appointments.csv")
                        .header("Authorization", "Bearer " + patientToken))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/admin/exports/transactions.csv")
                        .header("Authorization", "Bearer " + patientToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/v1/admin/analytics returns monthly revenue, top specialties, and cancellation metrics")
    void analyticsAggregatesMetrics() throws Exception {
        DoctorSlot s1 = slotRepository.save(DoctorSlot.builder()
                .doctorId(cardiologyDoctor.getId())
                .slotAt(OffsetDateTime.now().plusDays(1))
                .booked(true)
                .build());
        DoctorSlot s2 = slotRepository.save(DoctorSlot.builder()
                .doctorId(cardiologyDoctor.getId())
                .slotAt(OffsetDateTime.now().plusDays(2))
                .booked(false)
                .build());
        DoctorSlot s3 = slotRepository.save(DoctorSlot.builder()
                .doctorId(neurologyDoctor.getId())
                .slotAt(OffsetDateTime.now().plusDays(3))
                .booked(true)
                .build());

        Appointment a1 = appointmentRepository.save(Appointment.builder()
                .patientId(patientUser.getId())
                .doctorId(cardiologyDoctor.getId())
                .slotId(s1.getId())
                .consultationType(ConsultationType.VIDEO)
                .urgency(Urgency.ROUTINE)
                .status(AppointmentStatus.COMPLETED)
                .build());
        Appointment a2 = appointmentRepository.save(Appointment.builder()
                .patientId(patientUser.getId())
                .doctorId(cardiologyDoctor.getId())
                .slotId(s2.getId())
                .consultationType(ConsultationType.IN_PERSON)
                .urgency(Urgency.URGENT)
                .status(AppointmentStatus.CANCELLED)
                .cancellationReason("Patient unavailable, rescheduled")
                .refundPercentage(100)
                .refundAmountPaise(80000L)
                .build());
        appointmentRepository.save(Appointment.builder()
                .patientId(patientUser.getId())
                .doctorId(neurologyDoctor.getId())
                .slotId(s3.getId())
                .consultationType(ConsultationType.IN_PERSON)
                .urgency(Urgency.ROUTINE)
                .status(AppointmentStatus.NO_SHOW)
                .build());

        PaymentOrder paidOrder = paymentOrderRepository.save(PaymentOrder.builder()
                .patientId(patientUser.getId())
                .doctorId(cardiologyDoctor.getId())
                .appointmentId(a1.getId())
                .razorpayOrderId("order_analytics_1")
                .razorpayPaymentId("pay_analytics_1")
                .amountPaise(80000L)
                .currency("INR")
                .receipt("rcpt_1")
                .status(PaymentOrder.Status.PAID)
                .build());

        paymentRefundRepository.save(PaymentRefund.builder()
                .paymentOrderId(paidOrder.getId())
                .appointmentId(a2.getId())
                .patientId(patientUser.getId())
                .originalAmountPaise(80000L)
                .refundAmountPaise(20000L)
                .retentionAmountPaise(60000L)
                .refundPercentage(25)
                .tier("PARTIAL")
                .status("PROCESSED")
                .build());

        mvc.perform(get("/api/v1/admin/analytics?months=6")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.monthlyRevenue.length()").value(6))
                .andExpect(jsonPath("$.data.monthlyRevenue[5].revenuePaise").value(80000))
                .andExpect(jsonPath("$.data.monthlyRevenue[5].refundPaise").value(20000))
                .andExpect(jsonPath("$.data.monthlyRevenue[5].netRevenuePaise").value(60000))
                .andExpect(jsonPath("$.data.topSpecialties[0].specialty").value("Cardiology"))
                .andExpect(jsonPath("$.data.topSpecialties[0].appointmentCount").value(2))
                .andExpect(jsonPath("$.data.topSpecialties[0].cancelledCount").value(1))
                .andExpect(jsonPath("$.data.topSpecialties[1].specialty").value("Neurology"))
                .andExpect(jsonPath("$.data.topSpecialties[1].noShowCount").value(1))
                .andExpect(jsonPath("$.data.cancellationMetrics.totalAppointments").value(3))
                .andExpect(jsonPath("$.data.cancellationMetrics.completedCount").value(1))
                .andExpect(jsonPath("$.data.cancellationMetrics.cancelledCount").value(1))
                .andExpect(jsonPath("$.data.cancellationMetrics.noShowCount").value(1));
    }

    @Test
    @DisplayName("Date-filtered CSV exports stream valid headers, escaped cells, and handle >200 rows across chunks")
    void csvExportsStreamAcrossChunksAndEscapeSafely() throws Exception {
        // Insert 210 appointments (> EXPORT_CHUNK_SIZE=200) to verify multi-chunk streaming
        List<DoctorSlot> slots = new ArrayList<>(210);
        OffsetDateTime baseSlot = OffsetDateTime.now(ZoneOffset.UTC).plusDays(1);
        for (int i = 0; i < 210; i++) {
            slots.add(DoctorSlot.builder()
                    .doctorId(cardiologyDoctor.getId())
                    .slotAt(baseSlot.plusMinutes(i * 15L))
                    .booked(true)
                    .build());
        }
        slots = slotRepository.saveAll(slots);

        List<Appointment> appts = new ArrayList<>(210);
        for (int i = 0; i < 210; i++) {
            appts.add(Appointment.builder()
                    .patientId(patientUser.getId())
                    .doctorId(cardiologyDoctor.getId())
                    .slotId(slots.get(i).getId())
                    .consultationType(ConsultationType.VIDEO)
                    .urgency(Urgency.ROUTINE)
                    .status(i == 0 ? AppointmentStatus.CANCELLED : AppointmentStatus.COMPLETED)
                    .cancellationReason(i == 0 ? "Needs \"urgent\" reschedule, asap" : null)
                    .build());
        }
        appointmentRepository.saveAll(appts);

        paymentOrderRepository.save(PaymentOrder.builder()
                .patientId(patientUser.getId())
                .doctorId(cardiologyDoctor.getId())
                .appointmentId(appts.get(0).getId())
                .razorpayOrderId("order_csv_1")
                .razorpayPaymentId("pay_csv_1")
                .amountPaise(80000L)
                .currency("INR")
                .receipt("rcpt_csv_1")
                .status(PaymentOrder.Status.PAID)
                .build());

        String today = LocalDate.now(ZoneOffset.UTC).toString();

        MvcResult apptRes = mvc.perform(get("/api/v1/admin/exports/appointments.csv")
                        .param("from", today)
                        .param("to", today)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"pulsecare-appointments-report.csv\""))
                .andReturn();

        String apptCsv = apptRes.getResponse().getContentAsString();
        assertThat(apptCsv).startsWith("\uFEFFAppointment ID,Created At,Slot Time,Patient Name");
        // Formula injection sanitized and commas/quotes escaped
        assertThat(apptCsv).contains("'=SUM(A1:A2) Patient");
        assertThat(apptCsv).contains("\"Needs \"\"urgent\"\" reschedule, asap\"");
        String[] apptLines = apptCsv.split("\r\n");
        assertThat(apptLines.length).isEqualTo(211); // 1 header + 210 data rows

        MvcResult txnRes = mvc.perform(get("/api/v1/admin/exports/transactions.csv")
                        .param("from", today)
                        .param("to", today)
                        .param("status", "PAID")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"pulsecare-transactions-report.csv\""))
                .andReturn();

        String txnCsv = txnRes.getResponse().getContentAsString();
        assertThat(txnCsv).startsWith("\uFEFFOrder ID,Razorpay Order ID,Razorpay Payment ID");
        assertThat(txnCsv).contains("order_csv_1");
        assertThat(txnCsv).contains("800.00");

        // Invalid date range must return 400 Bad Request
        mvc.perform(get("/api/v1/admin/exports/appointments.csv")
                        .param("from", "2026-12-31")
                        .param("to", "2026-01-01")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }
}
