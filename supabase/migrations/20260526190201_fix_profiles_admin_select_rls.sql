/*
  # Fix profiles admin SELECT RLS policy

  The "Admins can view all profiles" policy uses a self-referencing subquery on the
  profiles table (checking profiles.role within a profiles policy), which causes
  recursive RLS evaluation. Replace it with the get_my_role() helper.
*/

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');
