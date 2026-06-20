CREATE TABLE IF NOT EXISTS board_snapshots (
  id bigserial PRIMARY KEY,
  board_id bigint NOT NULL REFERENCES planning_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  canvas_data jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_snapshots_board_id_idx ON board_snapshots(board_id);

ALTER TABLE board_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_board_snapshots" ON board_snapshots FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_board_snapshots" ON board_snapshots FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "update_board_snapshots" ON board_snapshots FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "delete_board_snapshots" ON board_snapshots FOR DELETE
  TO authenticated USING (auth.uid() = created_by OR created_by IS NULL);
