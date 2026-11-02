package com.group6.healthcare.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "prescription_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrescriptionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "prescription_id", nullable = false)
    private UUID prescriptionId;

    @Column(name = "drug_name", nullable = false)
    private String drugName;

    @Column(name = "dose", nullable = false, length = 64)
    private String dose;

    @Column(name = "frequency", nullable = false, length = 64)
    private String frequency;

    @Column(name = "duration", nullable = false, length = 64)
    private String duration;

    @Column(name = "instructions")
    private String instructions;

    /**
     * Comma-separated list of {@link MealTiming} enum names. One of:
     *   "UNSPECIFIED"
     *   "AFTER_BREAKFAST"
     *   "AFTER_BREAKFAST,AFTER_DINNER"
     * Use {@link #getMealTimingList()} / {@link #setMealTimingList} to work with the typed list.
     */
    @Column(name = "meal_timing", nullable = false, length = 256)
    private String mealTimingCsv;

    @Column(name = "position", nullable = false)
    private int position;

    @Transient
    public List<MealTiming> getMealTimingList() {
        if (mealTimingCsv == null || mealTimingCsv.isBlank()) {
            return List.of(MealTiming.UNSPECIFIED);
        }
        String[] parts = mealTimingCsv.split(",");
        List<MealTiming> out = new ArrayList<>(parts.length);
        for (String p : parts) {
            String trimmed = p.trim();
            if (trimmed.isEmpty()) continue;
            try {
                out.add(MealTiming.valueOf(trimmed));
            } catch (IllegalArgumentException ignored) {
                // skip unknown values — keeps us tolerant of hand-edited rows
            }
        }
        return out.isEmpty() ? List.of(MealTiming.UNSPECIFIED) : out;
    }

    public void setMealTimingList(List<MealTiming> list) {
        if (list == null || list.isEmpty()) {
            this.mealTimingCsv = MealTiming.UNSPECIFIED.name();
            return;
        }
        // If UNSPECIFIED is in the list, it wins — "none" cannot combine with real timings.
        if (list.contains(MealTiming.UNSPECIFIED)) {
            this.mealTimingCsv = MealTiming.UNSPECIFIED.name();
            return;
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(list.get(i).name());
        }
        this.mealTimingCsv = sb.toString();
    }

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (mealTimingCsv == null || mealTimingCsv.isBlank()) {
            mealTimingCsv = MealTiming.UNSPECIFIED.name();
        }
    }
}
