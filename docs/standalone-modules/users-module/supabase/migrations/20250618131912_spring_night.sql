/*
  # Add department field to user_profiles table

  1. Changes
    - Add `department` column to user_profiles table
    - Update existing users with default department based on their role
    - Add index for department field

  2. Security
    - No changes to RLS policies needed
*/

-- Add department column to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN department text;
  END IF;
END $$;

-- Create index for department field
CREATE INDEX IF NOT EXISTS idx_user_profiles_department ON user_profiles(department);

-- Update existing users with default departments based on their role
UPDATE user_profiles 
SET department = CASE 
  WHEN role = 'admin' THEN 'Estoque'
  WHEN role = 'operator' THEN 'TI'
  WHEN role = 'requester' THEN 'Área técnica'
  ELSE 'Área técnica'
END
WHERE department IS NULL;