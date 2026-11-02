-- V9__hospitals.sql
-- Hospital directory. Populated from data.gov.in PMJAY CSV at startup (dev profile only).
-- Covers FR-03 (hospital search), DR-07 unaffiliated.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE hospitals (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(512) NOT NULL,
    address         TEXT,
    city            VARCHAR(128),       -- maps from CSV "District" per PMJAY schema
    state           VARCHAR(128),
    pincode         VARCHAR(16),
    phone           VARCHAR(128),
    specialties     TEXT,                -- CSV: "Cardiology, Neurology, …"
    logo_url        VARCHAR(512),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Trigram index for fuzzy name search (ILIKE '%foo%' uses this).
CREATE INDEX ix_hospitals_name_trgm   ON hospitals USING gin (name gin_trgm_ops);
CREATE INDEX ix_hospitals_city        ON hospitals (city);
CREATE INDEX ix_hospitals_state       ON hospitals (state);
CREATE INDEX ix_hospitals_specialties ON hospitals USING gin (specialties gin_trgm_ops);
