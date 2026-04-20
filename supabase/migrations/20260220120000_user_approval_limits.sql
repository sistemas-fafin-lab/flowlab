-- Migration: User Approval Limits
-- Description: Creates tables to store configurable approval limits
-- This replaces the hardcoded approval logic in getPermissions()
-- Date: 2026-02-20

-- ============================================
-- STEP 1: Create approval_level_config table
-- Stores the configurable value for each approval level
-- ============================================

CREATE TABLE IF NOT EXISTS approval_level_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  max_amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  color VARCHAR(50) DEFAULT 'blue',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT approval_level_config_level_check 
    CHECK (level IN ('none', 'level_1', 'level_2', 'level_3', 'level_4'))
);

-- Insert default configuration (these values can be changed by admin)
INSERT INTO approval_level_config (level, label, max_amount, description, color, display_order) VALUES
  ('none', 'Sem Permissão', 0, 'Usuário não pode aprovar cotações', 'gray', 0),
  ('level_1', 'Nível 1 - Operacional', 5000.00, 'Aprovação de cotações de baixo valor', 'green', 1),
  ('level_2', 'Nível 2 - Gerencial', 25000.00, 'Aprovação de cotações de valor médio', 'blue', 2),
  ('level_3', 'Nível 3 - Diretoria', 100000.00, 'Aprovação de cotações de alto valor', 'purple', 3),
  ('level_4', 'Nível 4 - Presidência', 999999999.99, 'Aprovação ilimitada', 'red', 4)
ON CONFLICT (level) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_approval_level_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_approval_level_config_timestamp ON approval_level_config;
CREATE TRIGGER trigger_update_approval_level_config_timestamp
  BEFORE UPDATE ON approval_level_config
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_level_config_timestamp();

-- ============================================
-- STEP 2: Create user_approval_limits table
-- ============================================

CREATE TABLE IF NOT EXISTS user_approval_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  approval_level VARCHAR(20) NOT NULL DEFAULT 'none',
  custom_max_amount DECIMAL(15, 2), -- Optional: override the level's default amount
  can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  
  -- Ensure one record per user
  CONSTRAINT user_approval_limits_unique_user UNIQUE (user_id),
  
  -- Validate approval level
  CONSTRAINT user_approval_limits_level_check 
    CHECK (approval_level IN ('none', 'level_1', 'level_2', 'level_3', 'level_4'))
);

-- Add custom_max_amount column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_approval_limits' 
    AND column_name = 'custom_max_amount'
  ) THEN
    ALTER TABLE user_approval_limits ADD COLUMN custom_max_amount DECIMAL(15, 2);
  END IF;
END $$;

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_user_approval_limits_user 
  ON user_approval_limits(user_id);

-- Index for finding users who can approve
CREATE INDEX IF NOT EXISTS idx_user_approval_limits_can_approve 
  ON user_approval_limits(can_approve) WHERE can_approve = TRUE;

-- ============================================
-- STEP 3: Create trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_user_approval_limits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_approval_limits_timestamp ON user_approval_limits;
CREATE TRIGGER trigger_update_user_approval_limits_timestamp
  BEFORE UPDATE ON user_approval_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_user_approval_limits_timestamp();

-- ============================================
-- STEP 4: Initialize default limits for existing users
-- ============================================

-- Admins get level_4 (unlimited approval)
INSERT INTO user_approval_limits (user_id, approval_level, can_approve)
SELECT id, 'level_4', TRUE
FROM user_profiles
WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- Operators get level_1
INSERT INTO user_approval_limits (user_id, approval_level, can_approve)
SELECT id, 'level_1', TRUE
FROM user_profiles
WHERE role = 'operator'
ON CONFLICT (user_id) DO NOTHING;

-- Requesters get no approval rights
INSERT INTO user_approval_limits (user_id, approval_level, can_approve)
SELECT id, 'none', FALSE
FROM user_profiles
WHERE role = 'requester'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 5: RLS Policies
-- ============================================

ALTER TABLE approval_level_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_approval_limits ENABLE ROW LEVEL SECURITY;

-- Anyone can view approval level config (needed to show in UI)
DROP POLICY IF EXISTS "approval_level_config_select" ON approval_level_config;
CREATE POLICY "approval_level_config_select" ON approval_level_config
  FOR SELECT USING (TRUE);

-- Only admins can manage approval level config
DROP POLICY IF EXISTS "approval_level_config_update" ON approval_level_config;
CREATE POLICY "approval_level_config_update" ON approval_level_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Anyone can view approval limits (needed to determine permissions)
DROP POLICY IF EXISTS "user_approval_limits_select" ON user_approval_limits;
CREATE POLICY "user_approval_limits_select" ON user_approval_limits
  FOR SELECT USING (TRUE);

-- Only admins can manage approval limits
DROP POLICY IF EXISTS "user_approval_limits_insert" ON user_approval_limits;
CREATE POLICY "user_approval_limits_insert" ON user_approval_limits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "user_approval_limits_update" ON user_approval_limits;
CREATE POLICY "user_approval_limits_update" ON user_approval_limits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "user_approval_limits_delete" ON user_approval_limits;
CREATE POLICY "user_approval_limits_delete" ON user_approval_limits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ===========================================================
-- STEP 6: Create view for user approval with effective amount
-- ===========================================================

CREATE OR REPLACE VIEW user_approval_limits_with_details AS
SELECT 
  ual.id,
  ual.user_id,
  up.name as user_name,
  up.email as user_email,
  up.role as user_role,
  up.department,
  ual.approval_level,
  alc.label as level_label,
  alc.max_amount as level_max_amount,
  ual.custom_max_amount,
  COALESCE(ual.custom_max_amount, alc.max_amount) as effective_max_amount,
  ual.can_approve,
  ual.notes,
  ual.created_at,
  ual.updated_at
FROM user_approval_limits ual
JOIN user_profiles up ON up.id = ual.user_id
LEFT JOIN approval_level_config alc ON alc.level = ual.approval_level;

-- ============================================
-- STEP 7: Helper function to get user's effective approval limit
-- ============================================

CREATE OR REPLACE FUNCTION get_user_approval_limit(p_user_id UUID)
RETURNS TABLE (
  approval_level VARCHAR(20),
  max_amount DECIMAL(15, 2),
  can_approve BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ual.approval_level,
    COALESCE(ual.custom_max_amount, alc.max_amount) as max_amount,
    ual.can_approve
  FROM user_approval_limits ual
  LEFT JOIN approval_level_config alc ON alc.level = ual.approval_level
  WHERE ual.user_id = p_user_id;
  
  -- If no record found, return defaults based on user role
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      CASE 
        WHEN up.role = 'admin' THEN 'level_4'::VARCHAR(20)
        WHEN up.role = 'operator' THEN 'level_1'::VARCHAR(20)
        ELSE 'none'::VARCHAR(20)
      END,
      CASE 
        WHEN up.role = 'admin' THEN (SELECT alc.max_amount FROM approval_level_config alc WHERE alc.level = 'level_4')
        WHEN up.role = 'operator' THEN (SELECT alc.max_amount FROM approval_level_config alc WHERE alc.level = 'level_1')
        ELSE 0.00::DECIMAL(15,2)
      END,
      CASE 
        WHEN up.role IN ('admin', 'operator') THEN TRUE
        ELSE FALSE
      END
    FROM user_profiles up
    WHERE up.id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
