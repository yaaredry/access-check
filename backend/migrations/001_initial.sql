-- Migration: 001_initial
-- Create core tables for access-check system

DO $$ BEGIN
  CREATE TYPE identifier_type_enum AS ENUM ('IL_ID', 'IDF_ID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verdict_enum AS ENUM ('APPROVED', 'NOT_APPROVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS people (
    id                   SERIAL PRIMARY KEY,
    identifier_type      identifier_type_enum NOT NULL,
    identifier_value     VARCHAR(50) NOT NULL,
    verdict              verdict_enum NOT NULL DEFAULT 'NOT_APPROVED',
    approval_expiration  DATE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_identifier UNIQUE (identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_people_identifier_value ON people (identifier_value);
CREATE INDEX IF NOT EXISTS idx_people_verdict ON people (verdict);

CREATE TABLE IF NOT EXISTS audit_logs (
    id               SERIAL PRIMARY KEY,
    action           VARCHAR(50) NOT NULL,
    identifier_type  VARCHAR(20),
    identifier_value VARCHAR(50),
    verdict          VARCHAR(20),
    source           VARCHAR(20) NOT NULL DEFAULT 'manual',
    metadata         JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_identifier_value ON audit_logs (identifier_value);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_people_updated_at ON people;
CREATE TRIGGER trg_people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
