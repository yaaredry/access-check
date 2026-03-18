-- Migration: 004_last_seen_at
-- Track when a person was last scanned/verified at the gate

ALTER TABLE people ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;
