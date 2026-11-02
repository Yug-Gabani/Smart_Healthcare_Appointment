package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.entity.DoctorScheduleTemplate;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.repository.DoctorScheduleTemplateRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Materialises a doctor's weekly recurring schedule into concrete {@link DoctorSlot} rows.
 *
 * <p>Called whenever the doctor saves their weekly template. All <em>unbooked</em> future slots
 * are dropped first, then regenerated for the next {@value #DEFAULT_HORIZON_DAYS} days. Booked
 * slots are never touched. Duplicate rows at the same (doctor, time) are skipped using the
 * underlying {@code UNIQUE(doctor_id, slot_at)} constraint via INSERT ... ON CONFLICT DO NOTHING.
 */
@Service
public class SlotGeneratorService {

    public static final int DEFAULT_HORIZON_DAYS = 28;

    private final DoctorScheduleTemplateRepository templateRepository;
    private final DoctorSlotRepository slotRepository;

    @PersistenceContext
    private EntityManager em;

    public SlotGeneratorService(DoctorScheduleTemplateRepository templateRepository,
                                DoctorSlotRepository slotRepository) {
        this.templateRepository = templateRepository;
        this.slotRepository = slotRepository;
    }

    @Transactional
    public int regenerate(UUID doctorId) {
        return regenerate(doctorId, DEFAULT_HORIZON_DAYS);
    }

    @Transactional
    public int regenerate(UUID doctorId, int horizonDays) {
        // Drop all unbooked future slots so stale template rows don't linger.
        em.createNativeQuery(
                "DELETE FROM doctor_slots " +
                "WHERE doctor_id = :doctorId AND is_booked = false AND slot_at > NOW()")
                .setParameter("doctorId", doctorId)
                .executeUpdate();

        List<DoctorScheduleTemplate> templates =
                templateRepository.findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(doctorId);
        if (templates.isEmpty()) return 0;

        OffsetDateTime now = OffsetDateTime.now();
        ZoneOffset offset = now.getOffset();
        LocalDate today = now.toLocalDate();
        int inserted = 0;

        for (int dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
            LocalDate date = today.plusDays(dayOffset);
            int isoDow = date.getDayOfWeek().getValue();  // 1..7
            for (DoctorScheduleTemplate t : templates) {
                if (t.getDayOfWeek() != isoDow) continue;
                LocalDateTime cursor = LocalDateTime.of(date, t.getStartTime());
                LocalDateTime cutoff = LocalDateTime.of(date, t.getEndTime());
                while (!cursor.plusMinutes(t.getSlotDurationMinutes()).isAfter(cutoff)) {
                    OffsetDateTime slotAt = cursor.atOffset(offset);
                    if (slotAt.isAfter(now)) {
                        inserted += insertIfAbsent(doctorId, slotAt);
                    }
                    cursor = cursor.plusMinutes(t.getSlotDurationMinutes());
                }
            }
        }
        return inserted;
    }

    private int insertIfAbsent(UUID doctorId, OffsetDateTime slotAt) {
        // The unique (doctor_id, slot_at) constraint already prevents duplicates (incl. booked slots).
        return em.createNativeQuery(
                "INSERT INTO doctor_slots (id, doctor_id, slot_at, is_booked, created_at) " +
                "VALUES (uuid_generate_v4(), :doctorId, :slotAt, false, NOW()) " +
                "ON CONFLICT (doctor_id, slot_at) DO NOTHING")
                .setParameter("doctorId", doctorId)
                .setParameter("slotAt", slotAt)
                .executeUpdate();
    }
}
