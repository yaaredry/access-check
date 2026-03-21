-- Migration: 008_requester_name
-- Add requester_name column to store who submitted the access request

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS requester_name VARCHAR(150);
