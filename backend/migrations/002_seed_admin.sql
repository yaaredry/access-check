-- Migration: 002_seed_admin
-- Insert default admin user (password: Admin1234!)
-- Hash generated with bcrypt rounds=12

INSERT INTO users (username, password)
VALUES (
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/o.k7TZkxC'
)
ON CONFLICT (username) DO NOTHING;
