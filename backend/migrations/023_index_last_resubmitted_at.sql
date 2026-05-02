CREATE INDEX IF NOT EXISTS idx_people_last_resubmitted_at
  ON people (last_resubmitted_at)
  WHERE last_resubmitted_at IS NOT NULL;
