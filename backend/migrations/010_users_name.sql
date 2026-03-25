-- Migration: 010_users_name
-- Add display name column to users table (used by named requestors)

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(150);
