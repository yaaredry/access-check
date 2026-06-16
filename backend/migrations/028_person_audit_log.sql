-- Migration: 025_person_audit_log
-- Audit trail for person record mutations (created/updated/deleted/bulk_import)
-- person_id is stored as plain integer (no FK) so log entries survive person deletion

CREATE TABLE IF NOT EXISTS person_audit_log (
  id                  SERIAL PRIMARY KEY,
  person_id           INTEGER NOT NULL,
  event_type          VARCHAR(20) NOT NULL,
  changed_by_id       INTEGER,
  changed_by_username VARCHAR(100),
  changes             JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_audit_log_person_id ON person_audit_log (person_id);
CREATE INDEX IF NOT EXISTS idx_person_audit_log_created_at ON person_audit_log (created_at DESC);
