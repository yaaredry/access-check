-- Migration: 019_ensure_updated_at_trigger
-- The trg_people_updated_at trigger may be missing on databases that were
-- originally seeded from a dump or had 001_initial.sql marked as applied
-- before the trigger was actually created.  Migration 017 replaced the
-- set_updated_at() function body but did not re-register the trigger.
-- This migration idempotently ensures the trigger exists.

DROP TRIGGER IF EXISTS trg_people_updated_at ON people;
CREATE TRIGGER trg_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
