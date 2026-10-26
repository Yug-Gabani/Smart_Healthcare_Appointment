-- V1__baseline.sql
-- Flyway baseline. Keeps the migration chain valid; real schema arrives in
-- V2 (users_roles) and later migrations as each feature slice lands.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
