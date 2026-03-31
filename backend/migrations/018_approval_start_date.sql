-- Migration: 018_approval_start_date
-- Add approval_start_date column for date-range approvals.
-- When set, the verify endpoint returns NOT_YET_ACTIVE if today < start date.
-- Backwards compatible: existing records with NULL start date are unaffected.

ALTER TABLE people ADD COLUMN IF NOT EXISTS approval_start_date DATE;

-- Add NOT_YET_ACTIVE to the verdict enum
ALTER TYPE verdict_enum ADD VALUE IF NOT EXISTS 'NOT_YET_ACTIVE';
