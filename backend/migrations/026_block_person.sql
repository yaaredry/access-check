-- Add BLOCKED verdict to the enum
-- Cannot run inside a transaction; migration runner must handle this outside BEGIN/COMMIT
ALTER TYPE verdict_enum ADD VALUE IF NOT EXISTS 'BLOCKED';

-- Column to store the admin-provided block reason (not shown to requestors)
ALTER TABLE people ADD COLUMN IF NOT EXISTS block_reason VARCHAR(500);
