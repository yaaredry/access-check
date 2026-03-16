-- Migration: 003_admin_approved_verdict
-- Add ADMIN_APPROVED to verdict enum
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction block in PostgreSQL

ALTER TYPE verdict_enum ADD VALUE IF NOT EXISTS 'ADMIN_APPROVED';
