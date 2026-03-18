-- Migration: 005_gate_user_role
-- Add role column to users and seed the gate operator account

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Seed gate operator (password: megido1234!)
INSERT INTO users (username, password, role)
VALUES (
    'megido',
    '$2a$12$7Y/Z7wg3FTNmxTZD9vjWI.sfGRzvYCQQh8SZJzG90DUNoIluqNZcW',
    'gate'
)
ON CONFLICT (username) DO NOTHING;
