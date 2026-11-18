package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.entity.DoctorScheduleTemplate;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.repository.DoctorLeaveRepository;
import com.group6.healthcare.clinic.repository.DoctorScheduleTemplateRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
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
 * <p>Slots are automatically generated for the next 14 days.
 * Marking leave dates automatically suppresses slot creation and marks existing unbooked slots as unavailable.
 */
@Service
public class SlotGeneratorService {

    public static final int DEFAULT_HORIZON_DAYS = 14;

    private final DoctorScheduleTemplateRepository templateRepository;
    private final DoctorSlotRepository slotRepository;
    private final DoctorLeaveRepository leaveRepository;

    public SlotGeneratorService(DoctorScheduleTemplateRepository templateRepository,
                                DoctorSlotRepository slotRepository,
                                DoctorLeaveRepository leaveRepository) {
        this.templateRepository = templateRepository;
        this.slotRepository = slotRepository;
        this.leaveRepository = leaveRepository;
    }

    @Transactional
    public int regenerate(UUID doctorId) {
        return regenerate(doctorId, DEFAULT_HORIZON_DAYS);
    }

    @Transactional
    public int regenerate(UUID doctorId, int horizonDays) {
        // Drop all unbooked future slots so stale template rows don't linger.
        slotRepository.deleteUnbookedFutureSlots(doctorId, OffsetDateTime.now());

        List<DoctorScheduleTemplate> templates =
                templateRepository.findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(doctorId);
        if (templates.isEmpty()) return 0;

        OffsetDateTime now = OffsetDateTime.now();
        ZoneOffset offset = now.getOffset();
        LocalDate today = now.toLocalDate();
        int inserted = 0;

        for (int dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
            LocalDate date = today.plusDays(dayOffset);

            // Acceptance Criteria: Marking leave dates automatically suppresses slot creation
            if (leaveRepository.existsByDoctorIdAndDateInRange(doctorId, date)) {
                continue;
            }

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
        if (!slotRepository.existsByDoctorIdAndSlotAt(doctorId, slotAt)) {
            slotRepository.save(DoctorSlot.builder()
                    .doctorId(doctorId)
                    .slotAt(slotAt)
                    .booked(false)
                    .available(true)
                    .build());
            return 1;
        }
        return 0;
    }
}
