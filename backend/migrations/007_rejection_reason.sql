-- Migration: 007_rejection_reason
-- Add rejection_reason field to people table

ALTER TABLE people ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);
