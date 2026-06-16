-- Covering index for GET /access-requests/mine/suggestions
-- Query: WHERE requester_email = $1 ORDER BY identifier_value, created_at DESC
-- The existing idx_people_requester covers the WHERE clause but not the ORDER BY,
-- causing an in-memory sort. This index eliminates the sort entirely.
CREATE INDEX IF NOT EXISTS idx_people_requester_email_id_date
  ON people (requester_email, identifier_value, created_at DESC);
