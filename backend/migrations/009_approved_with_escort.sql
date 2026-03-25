-- Migration: 009_approved_with_escort
-- Add APPROVED_WITH_ESCORT to verdict_enum

ALTER TYPE verdict_enum ADD VALUE IF NOT EXISTS 'APPROVED_WITH_ESCORT';
