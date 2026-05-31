-- Migration: 027_user_can_extend
-- Add per-user flag controlling whether a requestor may use the one-click
-- "Request Extension" shortcut for expired entries.
-- Default TRUE preserves current behaviour for all existing users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_extend BOOLEAN NOT NULL DEFAULT TRUE;
