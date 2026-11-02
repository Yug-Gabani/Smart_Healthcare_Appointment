package com.group6.healthcare.clinic.entity;

public enum MealTiming {
    UNSPECIFIED,
    BEFORE_BREAKFAST,
    AFTER_BREAKFAST,
    BEFORE_LUNCH,
    AFTER_LUNCH,
    BEFORE_DINNER,
    AFTER_DINNER,
    WITH_MEAL,
    EMPTY_STOMACH,
    AT_BEDTIME,
    AS_NEEDED;

    /** Human-readable label used in patient-facing surfaces and the PDF. */
    public String label() {
        return switch (this) {
            case UNSPECIFIED      -> "";
            case BEFORE_BREAKFAST -> "before breakfast";
            case AFTER_BREAKFAST  -> "after breakfast";
            case BEFORE_LUNCH     -> "before lunch";
            case AFTER_LUNCH      -> "after lunch";
            case BEFORE_DINNER    -> "before dinner";
            case AFTER_DINNER     -> "after dinner";
            case WITH_MEAL        -> "with a meal";
            case EMPTY_STOMACH    -> "on empty stomach";
            case AT_BEDTIME       -> "at bedtime";
            case AS_NEEDED        -> "as needed";
        };
    }
}
