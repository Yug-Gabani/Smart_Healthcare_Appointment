package com.group6.healthcare.clinic.seed;

import com.group6.healthcare.clinic.entity.Hospital;
import com.group6.healthcare.clinic.repository.HospitalRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * One-shot CSV import from data.gov.in PMJAY hospital directory. Runs on dev-profile startup.
 * Idempotent: skips if hospitals table has any rows. First import takes ~30s for 30K rows.
 */
@Configuration
@Profile("dev")
public class HospitalCsvLoader {

    private static final Logger log = LoggerFactory.getLogger(HospitalCsvLoader.class);
    private static final String RESOURCE_PATH = "seed/hospitals.csv";
    private static final int BATCH_SIZE = 1000;

    @Bean
    @org.springframework.core.annotation.Order(1)
    ApplicationRunner hospitalCsvRunner(HospitalRepository hospitalRepository) {
        return args -> load(hospitalRepository);
    }

    @Transactional
    void load(HospitalRepository repo) {
        if (repo.count() > 0) {
            log.info("Hospital CSV import skipped: {} rows already present.", repo.count());
            return;
        }
        ClassPathResource resource = new ClassPathResource(RESOURCE_PATH);
        if (!resource.exists()) {
            log.warn("Hospital CSV not found at classpath:{} — hospital directory will be empty.", RESOURCE_PATH);
            return;
        }
        log.info("Importing hospitals from classpath:{} …", RESOURCE_PATH);
        long started = System.currentTimeMillis();
        int imported = 0;
        List<Hospital> batch = new ArrayList<>(BATCH_SIZE);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8));
             CSVParser parser = new CSVParser(reader, CSVFormat.DEFAULT.builder()
                     .setHeader().setSkipHeaderRecord(true).setIgnoreEmptyLines(true).setTrim(true).build())) {
            for (CSVRecord row : parser) {
                Hospital h = toHospital(row);
                if (h == null) continue;
                batch.add(h);
                if (batch.size() >= BATCH_SIZE) {
                    repo.saveAll(batch);
                    imported += batch.size();
                    batch.clear();
                }
            }
            if (!batch.isEmpty()) {
                repo.saveAll(batch);
                imported += batch.size();
            }
        } catch (Exception e) {
            log.error("Hospital CSV import failed", e);
            throw new IllegalStateException("Hospital CSV import failed: " + e.getMessage(), e);
        }
        long ms = System.currentTimeMillis() - started;
        log.info("Hospital CSV import complete: {} rows in {} ms.", imported, ms);
    }

    private static Hospital toHospital(CSVRecord row) {
        String name = cleanOrNull(row.get("Hospital_Name"));
        if (name == null) return null;
        return Hospital.builder()
                .name(truncate(name, 512))
                .address(cleanOrNull(row.get("Address_Original_First_Line")))
                .city(cleanOrNull(row.get("District")))
                .state(cleanOrNull(row.get("State")))
                .pincode(cleanOrNull(row.get("Pincode")))
                .phone(firstNonBlank(cleanOrNull(row.get("Telephone")), cleanOrNull(row.get("Mobile_Number"))))
                .specialties(cleanSpecialties(row.get("Specialties")))
                .build();
    }

    /** PMJAY uses "0" as the sentinel for empty cells; also treat blanks as null. */
    private static String cleanOrNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        if (t.isEmpty() || "0".equals(t) || "NA".equalsIgnoreCase(t)) return null;
        return t;
    }

    /** Normalise specialty blob: strip newlines/multiple spaces so it searches cleanly. */
    private static String cleanSpecialties(String v) {
        String c = cleanOrNull(v);
        if (c == null) return null;
        return c.replaceAll("\\s*\\n\\s*", ", ").replaceAll("\\s{2,}", " ").trim();
    }

    private static String firstNonBlank(String a, String b) {
        return a != null ? a : b;
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
