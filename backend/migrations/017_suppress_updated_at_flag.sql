-- Migration: 017_suppress_updated_at_flag
-- Allow callers to suppress the auto-updated_at trigger by setting the
-- session variable app.suppress_updated_at = 'true' (SET LOCAL, so it
-- is automatically cleared at transaction end).
-- Used by upsertMany (GSheet import) so imported records keep their
-- original updated_at and do not bubble to the top of the admin list.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.suppress_updated_at', true) = 'true' THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
