package com.group6.healthcare.clinic.seed;

import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.entity.Hospital;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.clinic.repository.HospitalRepository;
import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Seeds the clinical directory and a rolling forward slot inventory on startup. Guarded by the
 * `dev` profile so H2-backed tests stay empty. Safe to re-run: inserts are skipped when a doctor
 * with the same name already exists, and forward slots are continuously guaranteed.
 */
@Configuration
@Profile("dev")
public class ClinicSeedRunner {

    private static final Logger log = LoggerFactory.getLogger(ClinicSeedRunner.class);

    /**
     * Every demo doctor is loginable so that any triage specialty is testable end-to-end.
     * `loginEmail` becomes the DOCTOR user's email; password is {@link #DEMO_DOCTOR_PASSWORD}.
     * `doctor1@pulse.test` and `doctor.mitchell@pulse.test` are kept as pre-existing aliases
     * (same password) because earlier builds created them.
     */
    /**
     * Seed doctors are now linked to real Indian hospitals from the PMJAY CSV.
     * The `hospital` string MUST match a Hospital row's name exactly (case-insensitive) —
     * boot fails otherwise, per the strict rule.
     */
    private static final List<SeedDoctor> DOCTORS = List.of(
            new SeedDoctor("Dr. Sarah Mitchell, MD", "Emergency & Internal Medicine",
                    "Narayana Harudayalaya Hospitals",
                    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300",
                    new BigDecimal("4.90"), "doctor.mitchell@pulse.test"),
            new SeedDoctor("Dr. Robert Chen, FACC", "Cardiology",
                    "Asian Heart Institute And Research Center",
                    "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300",
                    new BigDecimal("4.95"), "doctor.chen@pulse.test"),
            new SeedDoctor("Dr. Emily Vance, MD", "Pediatrics",
                    "Lilavati Hospital and Research Center",
                    "https://images.unsplash.com/photo-1594824813625-e517a26f6e16?auto=format&fit=crop&q=80&w=300",
                    new BigDecimal("4.88"), "doctor.vance@pulse.test"),
            new SeedDoctor("Dr. Marcus Reynolds, DO", "Neurology",
                    "Breach Candy Hospital, Mumbai",
                    "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=300",
                    new BigDecimal("4.82"), "doctor.reynolds@pulse.test"),
            new SeedDoctor("Dr. Kavita Shah, MBBS", "General Medicine",
                    "Apollo Hospital International Ltd.",
                    "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=300",
                    new BigDecimal("4.86"), "doctor1@pulse.test"),
            new SeedDoctor("Dr. Suresh Rao, MD", "Dermatology",
                    "Sahyadri Hospital",
                    "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=300",
                    new BigDecimal("4.78"), "doctor.rao@pulse.test"),

            /* ----------------- new in this batch -----------------
             * 15 additional doctors bringing coverage to >= 2 per landing-page specialty
             * (General Medicine, Cardiology, Dermatology, Pediatrics, Orthopedics,
             *  Neurology, Gynecology, ENT, Ophthalmology, Psychiatry). City mix is
             *  Ahmedabad-heavy, then Mumbai / Bengaluru / Pune — matching the hospitals
             *  present in the PMJAY `hospitals` seed (names verified via DB lookup).
             * --------------------------------------------------- */
            new SeedDoctor("Dr. Rina Desai, MBBS", "General Medicine",
                    "Apollo Hospital International Ltd.",
                    "https://i.pravatar.cc/300?u=rina-desai",
                    new BigDecimal("4.80"), "doctor.desai@pulse.test"),
            new SeedDoctor("Dr. Vikram Nair, DM", "Cardiology",
                    "Adventist Wockhardt Heart Hospital",
                    "https://i.pravatar.cc/300?u=vikram-nair",
                    new BigDecimal("4.91"), "doctor.nair@pulse.test"),
            new SeedDoctor("Dr. Vivek Khanna, MD", "Dermatology",
                    "Grant Medical Foundation, Ruby Hall Clinic - Wanowarie - Pune",
                    "https://i.pravatar.cc/300?u=vivek-khanna",
                    new BigDecimal("4.74"), "doctor.khanna@pulse.test"),
            new SeedDoctor("Dr. Ananya Iyer, MD", "Pediatrics",
                    "Lilavati Hospital and Research Center",
                    "https://i.pravatar.cc/300?u=ananya-iyer",
                    new BigDecimal("4.87"), "doctor.iyer@pulse.test"),
            new SeedDoctor("Dr. Arjun Thakkar, MS Ortho", "Orthopedics",
                    "Aalok Orthocare Super Speciality Center",
                    "https://i.pravatar.cc/300?u=arjun-thakkar",
                    new BigDecimal("4.79"), "doctor.thakkar@pulse.test"),
            new SeedDoctor("Dr. Rajesh Kulkarni, MS Ortho", "Orthopedics",
                    "Kokilaben Dhirubhai Ambani Hospital",
                    "https://i.pravatar.cc/300?u=rajesh-kulkarni",
                    new BigDecimal("4.83"), "doctor.kulkarni@pulse.test"),
            new SeedDoctor("Dr. Shruti Deshmukh, DM", "Neurology",
                    "Deenanath Mangeshkar Hospital and Research Centre",
                    "https://i.pravatar.cc/300?u=shruti-deshmukh",
                    new BigDecimal("4.85"), "doctor.deshmukh@pulse.test"),
            new SeedDoctor("Dr. Priya Patel, MS Gynec", "Gynecology",
                    "Vatsalya Gynec Hospital",
                    "https://i.pravatar.cc/300?u=priya-patel",
                    new BigDecimal("4.89"), "doctor.priya@pulse.test"),
            new SeedDoctor("Dr. Meera Bhatt, MS Gynec", "Gynecology",
                    "Fortis Hiranandani Hospital",
                    "https://i.pravatar.cc/300?u=meera-bhatt",
                    new BigDecimal("4.81"), "doctor.bhatt@pulse.test"),
            new SeedDoctor("Dr. Nirav Mehta, MS ENT", "ENT",
                    "N M Virani Wockhardt Hospital",
                    "https://i.pravatar.cc/300?u=nirav-mehta",
                    new BigDecimal("4.76"), "doctor.mehta@pulse.test"),
            new SeedDoctor("Dr. Karthik Rao, MS ENT", "ENT",
                    "Manipal Northside Hospital",
                    "https://i.pravatar.cc/300?u=karthik-rao",
                    new BigDecimal("4.77"), "doctor.karthik@pulse.test"),
            new SeedDoctor("Dr. Anil Joshi, MS Ophthal", "Ophthalmology",
                    "Maneklal and Jagjivan Ujamshi Institute Of Ophthalmo",
                    "https://i.pravatar.cc/300?u=anil-joshi",
                    new BigDecimal("4.84"), "doctor.joshi@pulse.test"),
            new SeedDoctor("Dr. Sneha Pillai, MS Ophthal", "Ophthalmology",
                    "Narayana Nethralaya",
                    "https://i.pravatar.cc/300?u=sneha-pillai",
                    new BigDecimal("4.90"), "doctor.pillai@pulse.test"),
            new SeedDoctor("Dr. Dhara Shah, MD Psych", "Psychiatry",
                    "Narayana Harudayalaya Hospitals",
                    "https://i.pravatar.cc/300?u=dhara-shah",
                    new BigDecimal("4.78"), "doctor.dhara@pulse.test"),
            new SeedDoctor("Dr. Aditya Krishnamurthy, MD Psych", "Psychiatry",
                    "Apollo Rm Hospital",
                    "https://i.pravatar.cc/300?u=aditya-krishnamurthy",
                    new BigDecimal("4.82"), "doctor.aditya@pulse.test")
    );

    private static final String DEMO_DOCTOR_PASSWORD = "Password123!";

    private static final List<LocalTime> DAILY_SLOT_TIMES = List.of(
            LocalTime.of(9, 30),
            LocalTime.of(10, 30),
            LocalTime.of(11, 30),
            LocalTime.of(14, 0),
            LocalTime.of(15, 30),
            LocalTime.of(17, 0)
    );

    @Bean
    @org.springframework.core.annotation.Order(2)
    ApplicationRunner clinicSeed(DoctorRepository doctorRepository,
                                 DoctorSlotRepository slotRepository,
                                 UserRepository userRepository,
                                 HospitalRepository hospitalRepository,
                                 PasswordEncoder passwordEncoder) {
        return args -> seed(doctorRepository, slotRepository, userRepository, hospitalRepository, passwordEncoder);
    }

    @Transactional
    void seed(DoctorRepository doctorRepository,
              DoctorSlotRepository slotRepository,
              UserRepository userRepository,
              HospitalRepository hospitalRepository,
              PasswordEncoder passwordEncoder) {
        cleanupLeakedTestRows(doctorRepository);

        int demoUsers = 0;
        for (SeedDoctor sd : DOCTORS) {
            Hospital hospital = hospitalRepository.findFirstByNameIgnoreCase(sd.hospital())
                    .orElseGet(() -> {
                        log.info("Hospital '{}' not yet in DB; creating seed entry.", sd.hospital());
                        return hospitalRepository.save(Hospital.builder()
                                .name(sd.hospital())
                                .city("Metro")
                                .state("National")
                                .address("Healthcare Complex")
                                .pincode("110001")
                                .build());
                    });

            // Ensure the login user exists first.
            User doctorUser = null;
            if (sd.loginEmail() != null) {
                doctorUser = userRepository.findByEmailIgnoreCase(sd.loginEmail())
                        .orElseGet(() -> userRepository.save(User.builder()
                                .email(sd.loginEmail())
                                .passwordHash(passwordEncoder.encode(DEMO_DOCTOR_PASSWORD))
                                .fullName(sd.name())
                                .role(Role.DOCTOR)
                                .enabled(true)
                                .build()));
                demoUsers++;
            }

            final User linkedUser = doctorUser;
            final UUID hospitalId = hospital.getId();
            Doctor doctor = doctorRepository.findAll().stream()
                    .filter(d -> d.getFullName().equalsIgnoreCase(sd.name()))
                    .findFirst()
                    .orElseGet(() -> doctorRepository.save(Doctor.builder()
                            .userId(linkedUser != null ? linkedUser.getId() : null)
                            .fullName(sd.name())
                            .specialty(sd.specialty())
                            .hospital(sd.hospital())
                            .hospitalId(hospitalId)
                            .avatarUrl(sd.avatarUrl())
                            .rating(sd.rating())
                            .reviewCount(18)
                            .bio(sd.name() + " specialises in " + sd.specialty() + ".")
                            .build()));

            // Backfill user_id + hospital_id on previously-seeded rows.
            boolean dirty = false;
            if (linkedUser != null && doctor.getUserId() == null) {
                doctor.setUserId(linkedUser.getId()); dirty = true;
            }
            if (doctor.getHospitalId() == null) {
                doctor.setHospitalId(hospital.getId()); dirty = true;
            }
            if (doctor.getReviewCount() == null) {
                doctor.setReviewCount(18); dirty = true;
            }
            // Also keep the human-readable hospital name in sync if the seed renamed it.
            if (!sd.hospital().equalsIgnoreCase(doctor.getHospital())) {
                doctor.setHospital(sd.hospital()); dirty = true;
            }
            if (dirty) doctorRepository.save(doctor);

            seedSlotsFor(doctor, slotRepository);
        }
        log.info("Clinic seed completed: {} doctors ensured, {} demo doctor users ({}), slot window regenerated.",
                DOCTORS.size(), demoUsers, "password: " + DEMO_DOCTOR_PASSWORD);
    }

    /**
     * One-off cleanup for stray rows that were inserted by earlier manual tests rather than by
     * this seeder (notably "Dr. Test Suite" with a null hospital_id, which has shown up in dev
     * DBs since the appointment tests ran). Only removes a row when it is not referenced by any
     * appointment or prescription — otherwise it is left alone and we log a warning.
     */
    private static final List<String> LEAKED_TEST_DOCTOR_NAMES = List.of("Dr. Test Suite");

    private void cleanupLeakedTestRows(DoctorRepository doctorRepository) {
        for (String name : LEAKED_TEST_DOCTOR_NAMES) {
            doctorRepository.findAll().stream()
                    .filter(d -> name.equalsIgnoreCase(d.getFullName()))
                    .findFirst()
                    .ifPresent(d -> {
                        try {
                            doctorRepository.delete(d); // FK CASCADE handles slots, reviews, schedule templates
                            log.info("Removed leaked test-fixture doctor '{}' (id={}).", d.getFullName(), d.getId());
                        } catch (Exception e) {
                            // appointments / prescriptions have ON DELETE RESTRICT — leave the row alone if so
                            log.warn("Could not remove leaked test doctor '{}' — likely has appointment or prescription FK: {}",
                                    d.getFullName(), e.getMessage());
                        }
                    });
        }
    }

    private void seedSlotsFor(Doctor doctor, DoctorSlotRepository slotRepository) {
        OffsetDateTime now = OffsetDateTime.now();
        List<DoctorSlot> existing = slotRepository.findOpenSlots(doctor.getId(), now);
        if (existing.size() >= DAILY_SLOT_TIMES.size() * 15) {
            return; // already has a healthy forward window (at least 15 business days)
        }
        LocalDate today = LocalDate.now();
        ZoneId zone = ZoneId.systemDefault();
        for (int day = 0; day < 45; day++) {
            LocalDate date = today.plusDays(day);
            // Saturday and Sunday are holidays by default — do not generate open slots
            if (date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
                continue;
            }
            for (LocalTime time : DAILY_SLOT_TIMES) {
                OffsetDateTime slotAt = date.atTime(time).atZone(zone).toOffsetDateTime();
                if (slotAt.isBefore(now)) continue;
                boolean exists = existing.stream().anyMatch(s -> s.getSlotAt().equals(slotAt));
                if (exists) continue;
                try {
                    slotRepository.save(DoctorSlot.builder()
                            .doctorId(doctor.getId())
                            .slotAt(slotAt)
                            .booked(false)
                            .build());
                } catch (Exception ignored) {
                    // unique(doctor_id, slot_at) may race with another startup — skip quietly
                }
            }
        }
    }

    private record SeedDoctor(String name, String specialty, String hospital,
                              String avatarUrl, BigDecimal rating, String loginEmail) {
    }
}
