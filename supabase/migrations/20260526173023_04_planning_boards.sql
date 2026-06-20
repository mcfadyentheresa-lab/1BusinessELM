/*
  # Planning Boards, Canvas Elements, Board Items, Snapshots, Templates, Recent Views

  1. New Tables
    - `planning_boards` — Milanote-style spatial canvas, multiple per project
    - `canvas_elements` — individual draggable elements on a board
    - `board_items` — legacy board items (moodboard notes/images)
    - `board_snapshots` — version snapshots of a board canvas state
    - `board_templates` — user-saved reusable board templates
    - `recent_project_views` — per-user recent project history with last board
    - `board_presentation_tokens` — share tokens for public presentations

  2. Security
    - RLS on all tables
    - Admins/crew full access; clients read-only on their project boards
*/

-- Planning boards
CREATE TABLE IF NOT EXISTS planning_boards (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Board',
  mode text NOT NULL DEFAULT 'project',
  canvas_data jsonb,
  linked_milestone_id integer REFERENCES milestones(id),
  linked_checklist_item_id integer REFERENCES checklist_items(id),
  linked_calendar_event_id integer REFERENCES calendar_events(id),
  linked_user_ids text[] DEFAULT '{}',
  linked_project_ids integer[] DEFAULT '{}',
  color_tag_id integer,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE planning_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view planning boards"
  ON planning_boards FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project boards"
  ON planning_boards FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = planning_boards.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can manage planning boards"
  ON planning_boards FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update planning boards"
  ON planning_boards FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete planning boards"
  ON planning_boards FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Canvas elements
CREATE TABLE IF NOT EXISTS canvas_elements (
  id serial PRIMARY KEY,
  board_id integer NOT NULL REFERENCES planning_boards(id) ON DELETE CASCADE,
  type text NOT NULL,
  x integer NOT NULL DEFAULT 0,
  y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 240,
  height integer NOT NULL DEFAULT 160,
  z_index integer NOT NULL DEFAULT 0,
  parent_column_id integer,
  content jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE canvas_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view canvas elements"
  ON canvas_elements FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view canvas elements for own project boards"
  ON canvas_elements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM planning_boards pb
      JOIN projects p ON p.id = pb.project_id
      WHERE pb.id = canvas_elements.board_id AND p.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins and crew can manage canvas elements"
  ON canvas_elements FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update canvas elements"
  ON canvas_elements FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can delete canvas elements"
  ON canvas_elements FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

-- Legacy board items
CREATE TABLE IF NOT EXISTS board_items (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'note',
  title text,
  content text,
  image_url text,
  link_url text,
  color text DEFAULT '#ffffff',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view board items"
  ON board_items FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can manage board items"
  ON board_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update board items"
  ON board_items FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

-- Board snapshots
CREATE TABLE IF NOT EXISTS board_snapshots (
  id serial PRIMARY KEY,
  board_id integer NOT NULL REFERENCES planning_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  canvas_data jsonb NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE board_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view board snapshots"
  ON board_snapshots FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can manage board snapshots"
  ON board_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete board snapshots"
  ON board_snapshots FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Board templates
CREATE TABLE IF NOT EXISTS board_templates (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  canvas_data jsonb NOT NULL,
  source_board_id integer REFERENCES planning_boards(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE board_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view board templates"
  ON board_templates FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can manage board templates"
  ON board_templates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete board templates"
  ON board_templates FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Recent project views
CREATE TABLE IF NOT EXISTS recent_project_views (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_board_id integer,
  viewed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, project_id)
);

ALTER TABLE recent_project_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recent project views"
  ON recent_project_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own recent project views"
  ON recent_project_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own recent project views"
  ON recent_project_views FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Board presentation tokens (for public share links)
CREATE TABLE IF NOT EXISTS board_presentation_tokens (
  id serial PRIMARY KEY,
  board_id integer NOT NULL REFERENCES planning_boards(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE board_presentation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can manage presentation tokens"
  ON board_presentation_tokens FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can insert presentation tokens"
  ON board_presentation_tokens FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));
