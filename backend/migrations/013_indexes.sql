-- Migration: 013_indexes
-- Add missing indexes for user management and requestor queries

-- For login: findByUsername uses LOWER(username) = LOWER($1)
-- The existing unique index on username cannot be used for a functional expression
CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users (LOWER(username));

-- For listRequestors: filters users by role
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- For findByRequesterEmail and the JOIN in listRequestors (LOWER comparison)
CREATE INDEX IF NOT EXISTS idx_people_lower_requester_email ON people (LOWER(requester_email));
