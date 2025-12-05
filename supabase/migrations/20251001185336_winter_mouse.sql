/*
  # Update create_user_profile function to handle department and role assignment

  1. Function Updates
    - Read department from user metadata
    - Assign 'admin' role to first user, 'requester' to others
    - Handle name from metadata properly

  2. Security
    - Maintain SECURITY DEFINER for proper permissions
*/

-- Drop and recreate the function with updated logic
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  _default_role text;
  _profile_count integer;
  _user_name text;
  _user_department text;
BEGIN
  -- Count existing profiles to determine if this is the first user
  SELECT count(*) INTO _profile_count FROM public.user_profiles;

  -- If this is the first user, assign 'admin' role, otherwise 'requester'
  IF _profile_count = 0 THEN
    _default_role := 'admin';
  ELSE
    _default_role := 'requester';
  END IF;

  -- Extract name from metadata, fallback to email prefix if not provided
  _user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Extract department from metadata
  _user_department := NEW.raw_user_meta_data->>'department';

  -- Insert the user profile
  INSERT INTO public.user_profiles (id, email, name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    _user_name,
    _default_role,
    _user_department
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();