-- board_snapshots was left with two overlapping sets of RLS policies:
-- the original admin/crew-only ones from 20260526173023_04_planning_boards.sql
-- (re-created with get_my_role() in 20260526190328_fix_all_rls_policies_use_get_my_role.sql),
-- plus a second, differently-named set added by
-- 20260606221706_create_board_snapshots.sql that was never dropped.
--
-- Postgres OR's multiple permissive policies for the same command together, so the
-- later "select_board_snapshots ... USING (true)" policy alone made every board
-- snapshot readable by any authenticated user (any client, on any project), and the
-- accompanying insert/update/delete policies let any authenticated user write
-- snapshots onto any board_id via a self-owned created_by. This migration removes
-- the open policies and restores admin/crew-only access, matching the fact that the
-- snapshot/versions UI (VersionsPopover) is only ever mounted for admin/crew roles
-- in src/components/board/PlanningBoard.tsx.

DROP POLICY IF EXISTS "select_board_snapshots" ON board_snapshots;
DROP POLICY IF EXISTS "insert_board_snapshots" ON board_snapshots;
DROP POLICY IF EXISTS "update_board_snapshots" ON board_snapshots;
DROP POLICY IF EXISTS "delete_board_snapshots" ON board_snapshots;

DROP POLICY IF EXISTS "Admins and crew can view board snapshots" ON board_snapshots;
DROP POLICY IF EXISTS "Admins and crew can manage board snapshots" ON board_snapshots;
DROP POLICY IF EXISTS "Admins can delete board snapshots" ON board_snapshots;

CREATE POLICY "Admins and crew can view board snapshots" ON board_snapshots
  FOR SELECT TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin', 'crew']));

CREATE POLICY "Admins and crew can insert board snapshots" ON board_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin', 'crew']));

CREATE POLICY "Admins and crew can update board snapshots" ON board_snapshots
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin', 'crew']))
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin', 'crew']));

CREATE POLICY "Admins can delete board snapshots" ON board_snapshots
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');
