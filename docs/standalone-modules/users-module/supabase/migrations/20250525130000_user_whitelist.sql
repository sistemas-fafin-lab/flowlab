-- Migration: Add user_whitelist table and CPF tracking to user_profiles
-- Created: 2025-05-25

-- 1. Create user_whitelist table (source of truth for allowed users)
CREATE TABLE user_whitelist (
  cpf TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  activity BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add CPF column to user_profiles (FK to whitelist, UNIQUE for 1 profile per CPF)
ALTER TABLE user_profiles ADD COLUMN cpf TEXT UNIQUE;
ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_cpf
  FOREIGN KEY (cpf) REFERENCES user_whitelist(cpf);

-- 3. Enable RLS on user_whitelist
ALTER TABLE user_whitelist ENABLE ROW LEVEL SECURITY;

-- 4. Allow authenticated users to read whitelist (needed for signUp/signIn validation)
CREATE POLICY "whitelist_read_authenticated"
  ON user_whitelist FOR SELECT
  USING (auth.role() = 'authenticated');

-- 5. Allow write access only to users with custom_role containing 'canManageWhitelist'
--    No fallback to legacy role='admin'; strictly custom_roles.permissions based
CREATE POLICY "whitelist_write_custom_role"
  ON user_whitelist FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles p
      LEFT JOIN custom_roles cr ON cr.id = p.custom_role_id
      WHERE p.id = auth.uid()
        AND cr.permissions @> '["canManageWhitelist"]'::jsonb
    )
  );
