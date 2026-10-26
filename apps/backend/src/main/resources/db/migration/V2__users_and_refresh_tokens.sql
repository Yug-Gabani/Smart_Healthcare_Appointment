-- V2__users_and_refresh_tokens.sql
-- Core identity + role table and refresh-token store.
-- Covers FR-01 (register/login/logout), NFR-01 (authN), NFR-02 (RBAC baseline).

CREATE TABLE users (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    role            VARCHAR(32)  NOT NULL,
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_role CHECK (role IN
        ('PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN', 'STAFF'))
);

-- Case-insensitive uniqueness on email.
CREATE UNIQUE INDEX ux_users_email_lower ON users (LOWER(email));
CREATE INDEX ix_users_role ON users (role);

CREATE TABLE refresh_tokens (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(128) NOT NULL,
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_refresh_token_hash  ON refresh_tokens (token_hash);
CREATE INDEX        ix_refresh_tokens_user ON refresh_tokens (user_id);
