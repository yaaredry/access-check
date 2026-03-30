-- Migration: 015_stats_indexes
-- Add indexes required for efficient stats query execution.
--
-- Each index is mapped to the statsRepository function(s) it supports:
--
--   idx_audit_logs_action_created_at
--     → getGateScanCounts, getGateScanVerdictBreakdown, getHourlyScanActivity
--       All three filter on action='VERIFY' + a created_at time window.
--       The existing idx_audit_logs_created_at has no action prefix,
--       so the planner scans every action type before filtering.
--
--   idx_people_created_at
--     → getRequestCounts  (COUNT FILTER on created_at windows, full table)
--
--   idx_people_status_created_at
--     → getPendingBacklog  (WHERE status='PENDING' + created_at staleness checks)
--
--   idx_people_status_status_changed_at
--     → getVerdictCounts, getAvgTimeToVerdict
--       Both filter WHERE status != 'PENDING' AND status_changed_at IS NOT NULL
--       then apply time-window filters on status_changed_at.
--       The existing idx_people_status_changed_at has no status prefix.
--
--   idx_people_population
--     → getPopulationBreakdown  (WHERE population IS NOT NULL GROUP BY population)
--
--   idx_people_requester
--     → getTopRequestors  (WHERE requester_email IS NOT NULL OR requester_name IS NOT NULL
--                           GROUP BY requester_email, requester_name)

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at
  ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_people_created_at
  ON people (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_people_status_created_at
  ON people (status, created_at);

CREATE INDEX IF NOT EXISTS idx_people_status_status_changed_at
  ON people (status, status_changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_people_population
  ON people (population)
  WHERE population IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_requester
  ON people (requester_email, requester_name)
  WHERE requester_email IS NOT NULL OR requester_name IS NOT NULL;
