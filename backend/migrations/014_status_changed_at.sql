-- Migration: 014_status_changed_at
-- Track when a request most recently transitioned to a final verdict status.
-- Updated on every status change (not just the first), so it always reflects
-- when the current verdict was given.

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Back-fill for already-decided records: use updated_at as best proxy
UPDATE people
SET status_changed_at = updated_at
WHERE status IN ('APPROVED', 'NOT_APPROVED') AND status_changed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_people_status_changed_at ON people (status_changed_at);
