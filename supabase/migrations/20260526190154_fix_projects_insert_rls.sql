/*
  # Fix projects INSERT RLS policy

  The existing INSERT policy on projects does a subquery against the profiles table,
  which itself has RLS enabled. This causes a recursive RLS evaluation that silently
  blocks the insert even for admin users.

  Fix: replace the subquery-based check with a direct auth.uid() comparison against
  the profiles table using a security-definer function, OR simply rewrite the policy
  to use the auth.jwt() app_metadata role claim. Since we store role in the profiles
  table (not JWT claims), the simplest safe fix is to drop and recreate the policy
  using a SECURITY DEFINER helper function that bypasses RLS when checking the role.
*/

-- Create a security definer function to safely check the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Fix projects policies to use the helper instead of a subquery on RLS-protected profiles
DROP POLICY IF EXISTS "Admins can insert projects" ON projects;
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
DROP POLICY IF EXISTS "Admins and crew can view all projects" ON projects;

CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admins and crew can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('admin', 'crew'));
