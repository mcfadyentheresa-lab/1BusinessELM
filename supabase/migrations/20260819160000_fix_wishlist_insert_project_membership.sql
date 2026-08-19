/*
  # Fix project_wishlist_items INSERT policy - no project membership check

  ## Problem
  insert_own_wishlist only checked auth.uid() = user_id, never verifying
  the inserting user actually has access to the project_id they're writing
  into, despite the policy's own comment claiming otherwise ("Authenticated
  users can insert items linked to a project they belong to"). Any
  authenticated user - including a client on Project X - could insert a
  wishlist row against Project Y's project_id, writing noise into a
  project they have no legitimate connection to. Flagged in
  TENANCY_AUDIT.md item 8. Lower severity than the two live vulnerabilities
  already fixed this session, since it doesn't allow reading another
  project's data, only writing into it.

  ## Solution
  Mirror the existing, correct pattern already used on messages' INSERT
  policy (20260526190328_fix_all_rls_policies_use_get_my_role.sql:169-170):
  require the caller to either hold admin/crew role, or be the client
  actually assigned to the target project.
*/

DROP POLICY IF EXISTS "insert_own_wishlist" ON project_wishlist_items;

CREATE POLICY "insert_own_wishlist" ON project_wishlist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.get_my_role() = ANY (ARRAY['admin','crew'])
      OR EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_wishlist_items.project_id
          AND projects.client_id = auth.uid()
      )
    )
  );
