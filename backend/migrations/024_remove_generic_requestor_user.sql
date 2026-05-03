-- Migration: 024_remove_generic_requestor_user
-- Remove the legacy generic 'requestor' account seeded in 006_access_requests.
-- All requestors now have individual named accounts; this account should no longer be used.
DELETE FROM users WHERE username = 'requestor' AND role = 'access_requestor';
