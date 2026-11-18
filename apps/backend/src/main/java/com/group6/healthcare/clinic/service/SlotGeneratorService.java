package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.entity.DoctorLeave;
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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Materialises a doctor's weekly recurring schedule into concrete {@link DoctorSlot} rows.
 *
 * <p>Called whenever the doctor saves their weekly template or marks a leave. Slots are
 * automatically generated for the forward horizon (14 days). All <em>unbooked</em> future slots
 * are dropped first, then regenerated. Booked slots are never touched. Dates on which the doctor
 * has marked leave or vacation are suppressed from slot creation.
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
        OffsetDateTime now = OffsetDateTime.now();

        // Drop all unbooked future slots so stale template rows or newly marked leave dates don't linger.
        slotRepository.deleteUnbookedFutureSlots(doctorId, now);

        List<DoctorScheduleTemplate> templates =
                templateRepository.findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(doctorId);
        if (templates.isEmpty()) return 0;

        ZoneOffset offset = now.getOffset();
        LocalDate today = now.toLocalDate();
        LocalDate horizonEnd = today.plusDays(horizonDays);

        // Fetch leaves active during the generation horizon
        List<DoctorLeave> leaves = leaveRepository.findOverlappingLeaves(doctorId, today, horizonEnd);
        Set<LocalDate> leaveDates = new HashSet<>();
        for (DoctorLeave l : leaves) {
            LocalDate cur = l.getStartDate();
            while (!cur.isAfter(l.getEndDate())) {
                leaveDates.add(cur);
                cur = cur.plusDays(1);
            }
        }

        int inserted = 0;

        for (int dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
            LocalDate date = today.plusDays(dayOffset);
            // Suppress slot creation on doctor vacation/leave days
            if (leaveDates.contains(date)) {
                continue;
            }

            int isoDow = date.getDayOfWeek().getValue();  // 1..7 (1=Monday)
            for (DoctorScheduleTemplate t : templates) {
                if (t.getDayOfWeek() != isoDow) continue;
                LocalDateTime cursor = LocalDateTime.of(date, t.getStartTime());
                LocalDateTime cutoff = LocalDateTime.of(date, t.getEndTime());
                while (!cursor.plusMinutes(t.getSlotDurationMinutes()).isAfter(cutoff)) {
                    OffsetDateTime slotAt = cursor.atOffset(offset);
                    if (slotAt.isAfter(now)) {
                        if (!slotRepository.existsByDoctorIdAndSlotAt(doctorId, slotAt)) {
                            slotRepository.save(DoctorSlot.builder()
                                    .doctorId(doctorId)
                                    .slotAt(slotAt)
                                    .booked(false)
                                    .build());
                            inserted++;
                        }
                    }
                    cursor = cursor.plusMinutes(t.getSlotDurationMinutes());
                }
            }
        }
        return inserted;
    }
}
