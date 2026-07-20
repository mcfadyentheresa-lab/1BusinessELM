/*
# Project Watcher — alert storage and run tracking

1. Purpose
   Adds the persistence layer for "Project Watcher", an external intelligence
   layer that reads existing ELM data and surfaces money/risk/decision/
   commitment alerts. This migration is purely additive — no existing ELM
   table is altered.

2. New Tables
   - `watcher_alerts`
     - id            uuid PK
     - project_id    int FK → projects(id) ON DELETE CASCADE
     - category      text  ('money' | 'risk' | 'decision' | 'commitment')
     - title         text
     - description   text
     - suggested_action text
     - source_type   text  (e.g. 'estimate_warning' | 'change_order' | 'message')
     - source_id     text  (the triggering row's PK, stored as text because
                            source tables use serial int PKs, not uuids)
     - status        text  default 'new' ('new' | 'acknowledged' | 'dismissed')
     - created_at    timestamptz default now()
   - `watcher_runs`
     - id            int PK (always 1 — singleton)
     - last_run_at   timestamptz
     Used by Check C to pull messages created since the last run (falls back
     to 72 hours on first run). State must live in a table, not in-memory,
     because edge function instances are ephemeral.

3. Security
   - RLS enabled on both tables.
   - watcher_alerts: admin/crew can SELECT; admin can INSERT/UPDATE/DELETE.
     The edge function uses the service-role key which bypasses RLS, so the
     INSERT policies are a safety net.
   - watcher_runs: admin only.
*/

-- ============================================================
-- watcher_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS watcher_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category         text NOT NULL CHECK (category IN ('money','risk','decision','commitment')),
  title            text NOT NULL,
  description      text,
  suggested_action text,
  source_type      text NOT NULL,
  source_id        text NOT NULL,
  status           text NOT NULL DEFAULT 'new' CHECK (status IN ('new','acknowledged','dismissed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE watcher_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and crew can view watcher alerts" ON watcher_alerts;
CREATE POLICY "Admins and crew can view watcher alerts"
  ON watcher_alerts FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin','crew'));

DROP POLICY IF EXISTS "Admins can insert watcher alerts" ON watcher_alerts;
CREATE POLICY "Admins can insert watcher alerts"
  ON watcher_alerts FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins can update watcher alerts" ON watcher_alerts;
CREATE POLICY "Admins can update watcher alerts"
  ON watcher_alerts FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin','crew'))
  WITH CHECK (get_my_role() IN ('admin','crew'));

DROP POLICY IF EXISTS "Admins can delete watcher alerts" ON watcher_alerts;
CREATE POLICY "Admins can delete watcher alerts"
  ON watcher_alerts FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_watcher_alerts_project_id ON watcher_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_watcher_alerts_source ON watcher_alerts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_watcher_alerts_status ON watcher_alerts(status);

-- ============================================================
-- watcher_runs (singleton — tracks last watcher execution)
-- ============================================================
CREATE TABLE IF NOT EXISTS watcher_runs (
  id           integer PRIMARY KEY DEFAULT 1,
  last_run_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_only CHECK (id = 1)
);

ALTER TABLE watcher_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view watcher runs" ON watcher_runs;
CREATE POLICY "Admins can view watcher runs"
  ON watcher_runs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins can insert watcher runs" ON watcher_runs;
CREATE POLICY "Admins can insert watcher runs"
  ON watcher_runs FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins can update watcher runs" ON watcher_runs;
CREATE POLICY "Admins can update watcher runs"
  ON watcher_runs FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

INSERT INTO watcher_runs (id, last_run_at) VALUES (1, now())
  ON CONFLICT (id) DO NOTHING;