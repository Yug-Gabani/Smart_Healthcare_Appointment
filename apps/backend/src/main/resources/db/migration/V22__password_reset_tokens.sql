-- V22: password reset tokens
-- Covers FR-01 (auth) extension: self-service password reset via email token.
-- Tokens are single-use, short-lived, and stored as SHA-256 hashes so a leaked
-- row cannot be replayed. The plaintext token only ever lives in the user's email.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID         PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX        IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);
CREATE INDEX        IF NOT EXISTS idx_prt_expires_at ON password_reset_tokens(expires_at);
