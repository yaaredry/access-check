-- Migration: 011_people_requester_email
-- Track the email of the named requestor who submitted each access request

ALTER TABLE people ADD COLUMN IF NOT EXISTS requester_email VARCHAR(255);
