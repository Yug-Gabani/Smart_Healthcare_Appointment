package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.DoctorResponse;
import com.group6.healthcare.clinic.dto.SlotResponse;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.DoctorSlot;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.DoctorSlotRepository;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final DoctorSlotRepository slotRepository;

    public DoctorService(DoctorRepository doctorRepository, DoctorSlotRepository slotRepository) {
        this.doctorRepository = doctorRepository;
        this.slotRepository = slotRepository;
    }

    @Transactional(readOnly = true)
    public List<DoctorResponse> listDoctors(String specialtyQuery, UUID hospitalId) {
        String spec = (specialtyQuery == null || specialtyQuery.isBlank()) ? null : specialtyQuery;
        List<Doctor> doctors = (spec == null && hospitalId == null)
                ? doctorRepository.findApprovedOrderByRatingDescFullNameAsc()
                : doctorRepository.searchByFilters(spec, hospitalId);
        OffsetDateTime now = OffsetDateTime.now();
        return doctors.stream().map(d -> toResponse(d, now, 3)).toList();
    }

    /** Backwards-compatible single-arg overload. */
    @Transactional(readOnly = true)
    public List<DoctorResponse> listDoctors(String specialtyQuery) {
        return listDoctors(specialtyQuery, null);
    }

    private static final List<java.time.LocalTime> DAILY_SLOT_TIMES = List.of(
            java.time.LocalTime.of(9, 30),
            java.time.LocalTime.of(10, 30),
            java.time.LocalTime.of(11, 30),
            java.time.LocalTime.of(14, 0),
            java.time.LocalTime.of(15, 30),
            java.time.LocalTime.of(17, 0)
    );

    @Transactional(readOnly = true)
    public DoctorResponse getDoctor(UUID doctorId) {
        Doctor d = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", doctorId));
        return toResponse(d, OffsetDateTime.now(), 8);
    }

    @Transactional
    public List<SlotResponse> listOpenSlots(UUID doctorId) {
        Doctor d = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", doctorId));
        List<DoctorSlot> slots = slotRepository.findOpenSlots(doctorId, OffsetDateTime.now());
        if (slots.size() < 24) {
            replenishForwardSlots(d, 30);
            slots = slotRepository.findOpenSlots(doctorId, OffsetDateTime.now());
        }
        return slots.stream()
                .map(s -> new SlotResponse(s.getId(), s.getDoctorId(), s.getSlotAt(), s.isBooked()))
                .toList();
    }

    /**
     * Automatic rolling background task: runs every 6 hours to guarantee that
     * every approved doctor maintains a healthy 30-day forward booking window.
     */
    @Scheduled(cron = "0 0 */6 * * ?")
    @Transactional
    public void replenishAllApprovedDoctors() {
        List<Doctor> approved = doctorRepository.findApprovedOrderByRatingDescFullNameAsc();
        OffsetDateTime now = OffsetDateTime.now();
        for (Doctor doc : approved) {
            List<DoctorSlot> open = slotRepository.findOpenSlots(doc.getId(), now);
            if (open.size() < 24) {
                replenishForwardSlots(doc, 30);
            }
        }
    }

    @Transactional
    public void replenishForwardSlots(Doctor doctor) {
        replenishForwardSlots(doctor, 30);
    }

    @Transactional
    public void replenishForwardSlots(Doctor doctor, int daysAhead) {
        OffsetDateTime now = OffsetDateTime.now();
        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        int horizon = Math.max(7, daysAhead);
        for (int day = 0; day < horizon; day++) {
            java.time.LocalDate date = today.plusDays(day);
            if (date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
                continue;
            }
            for (java.time.LocalTime time : DAILY_SLOT_TIMES) {
                OffsetDateTime slotAt = date.atTime(time).atZone(zone).toOffsetDateTime();
                if (slotAt.isBefore(now)) continue;
                try {
                    slotRepository.save(DoctorSlot.builder()
                            .doctorId(doctor.getId())
                            .slotAt(slotAt)
                            .booked(false)
                            .build());
                } catch (Exception ignored) {
                    // unique constraint skips duplicates quietly
                }
            }
        }
    }

    private DoctorResponse toResponse(Doctor d, OffsetDateTime from, int limit) {
        List<DoctorSlot> openSlots = slotRepository.findOpenSlotsLimited(
                d.getId(), from, PageRequest.of(0, Math.max(1, limit)));
        if (openSlots.size() < limit) {
            replenishForwardSlots(d, 30);
            openSlots = slotRepository.findOpenSlotsLimited(
                    d.getId(), from, PageRequest.of(0, Math.max(1, limit)));
        }
        List<DoctorResponse.SlotSummary> previews = openSlots.stream()
                .map(s -> new DoctorResponse.SlotSummary(s.getId(), s.getSlotAt()))
                .toList();
        return new DoctorResponse(
                d.getId(),
                d.getFullName(),
                d.getSpecialty(),
                d.getHospital(),
                d.getHospitalId(),
                d.getAvatarUrl(),
                d.getRating(),
                d.getReviewCount() != null ? d.getReviewCount() : 0,
                d.getBio(),
                previews,
                previews.size()
        );
    }
}
