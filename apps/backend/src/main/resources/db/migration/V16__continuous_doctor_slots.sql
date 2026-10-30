-- ============================================================================
-- V16: Continuous Rolling Forward Doctor Slots (6-Month Perpetual Horizon)
-- Ensures all approved doctors always have forward booking slots available.
-- ============================================================================

DO $$
DECLARE
    doc RECORD;
    d DATE;
    t TIME;
    dow INT;
    slot_dt TIMESTAMPTZ;
    daily_times TIME[] := ARRAY[
        '09:30:00'::TIME,
        '10:30:00'::TIME,
        '11:30:00'::TIME,
        '14:00:00'::TIME,
        '15:30:00'::TIME,
        '17:00:00'::TIME
    ];
BEGIN
    FOR doc IN SELECT id FROM doctors WHERE status = 'APPROVED' LOOP
        FOR i IN 0..180 LOOP
            d := CURRENT_DATE + i;
            dow := EXTRACT(DOW FROM d);
            -- Skip Saturday (6) and Sunday (0)
            IF dow != 0 AND dow != 6 THEN
                FOREACH t IN ARRAY daily_times LOOP
                    slot_dt := (d + t) AT TIME ZONE 'Asia/Kolkata';
                    IF slot_dt > NOW() THEN
                        INSERT INTO doctor_slots (id, doctor_id, slot_at, is_booked, created_at)
                        VALUES (gen_random_uuid(), doc.id, slot_dt, false, NOW())
                        ON CONFLICT (doctor_id, slot_at) DO NOTHING;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;
END $$;
