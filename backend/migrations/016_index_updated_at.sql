-- Migration: 016_index_updated_at
-- Support efficient ORDER BY updated_at DESC for the people list.
-- The list sorts PENDING first, then all other rows by most-recently-updated.

CREATE INDEX IF NOT EXISTS idx_people_updated_at ON people (updated_at DESC);
