-- Migration: 006_access_requests
-- Add access request fields to people table and seed access_requestor role

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS population       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS division         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS escort_full_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS escort_phone     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS reason           VARCHAR(500),
  ADD COLUMN IF NOT EXISTS status           VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_people_status ON people (status);

-- Seed access_requestor user (password: access1234!)
INSERT INTO users (username, password, role)
VALUES (
    'requestor',
    '$2a$12$mf757XN3/nTPXaHPOaHaT.mndhNPbi374mn12No0BDY7byC2gGN3O',
    'access_requestor'
)
ON CONFLICT (username) DO NOTHING;
