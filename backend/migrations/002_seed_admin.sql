-- Migration: 002_seed_admin
-- Insert default admin user (password: Admin1234!)
-- Hash generated with bcrypt rounds=12

INSERT INTO users (username, password)
VALUES (
    'admin',
    '$2a$12$2pl1sY1DHViwWm/j1OOnR.TUc72GOgcXE2NlHFFryRm2iLBk4w.QS'
)
ON CONFLICT (username) DO NOTHING;
