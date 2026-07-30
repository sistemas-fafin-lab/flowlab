/*
  # Fix infinite recursion in user_profiles RLS policies

  1. Problem
    - The current admin policy creates infinite recursion by querying user_profiles within a policy on user_profiles
    - This happens when checking if a user is admin by looking up their role in the same table being queried

  2. Solution
    - Remove the problematic admin policy that causes recursion
    - Simplify policies to avoid circular dependencies
    - Use direct user ID comparisons instead of role-based lookups within policies
    - Keep basic policies for users to manage their own profiles

  3. Changes
    - Drop the recursive admin policy
    - Keep simple policies for users to read all profiles and update their own
    - Admin functionality will be handled at the application level instead of database level
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Allow admins to manage all profiles" ON user_profiles;

-- Ensure we have the basic policies that don't cause recursion
-- Policy to allow users to read all profiles (needed for the app to function)
DROP POLICY IF EXISTS "Allow authenticated users to read all profiles" ON user_profiles;
CREATE POLICY "Allow authenticated users to read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy to allow users to update their own profile
DROP POLICY IF EXISTS "Allow users to update their own profile" ON user_profiles;
CREATE POLICY "Allow users to update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy to allow users to insert their own profile (for new user registration)
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON user_profiles;
CREATE POLICY "Allow users to insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);