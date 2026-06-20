/*
  # Projects, Milestones, Sub-Milestones, Sections, Tasks

  1. New Tables
    - `projects` — core project record with budget, hero image, focal point
    - `milestones` — phases/milestones with date ranges and color tags
    - `sub_milestones` — checklist items under a milestone
    - `sections` — WBS grouping under milestones
    - `tasks` — individual work items with kanban status

  2. Security
    - RLS on all tables
    - Admins/crew can manage; clients can read their own project data
*/

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning',
  client_id uuid REFERENCES profiles(id),
  start_date date,
  end_date date,
  address text,
  city text,
  code text,
  phase text,
  current_focus_text text,
  current_focus_photo_id integer,
  thumbnail_url text,
  hero_focal_x real DEFAULT 0.5,
  hero_focal_y real DEFAULT 0.5,
  hero_zoom real DEFAULT 1.0,
  total_budget integer DEFAULT 0,
  budget_used integer DEFAULT 0,
  budget_visible_to_client boolean DEFAULT false,
  color_tag_id integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew'))
  );

CREATE POLICY "Clients can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Milestones
CREATE TABLE IF NOT EXISTS milestones (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  date date,
  start_date date,
  end_date date,
  completed boolean DEFAULT false,
  completed_by uuid REFERENCES profiles(id),
  "order" integer DEFAULT 0,
  color_hex text,
  paint_color_ids integer[]
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = milestones.project_id AND projects.client_id = auth.uid())
  );

CREATE POLICY "Admins can manage milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update milestones"
  ON milestones FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete milestones"
  ON milestones FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sub-milestones
CREATE TABLE IF NOT EXISTS sub_milestones (
  id serial PRIMARY KEY,
  milestone_id integer NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean DEFAULT false,
  "order" integer DEFAULT 0
);

ALTER TABLE sub_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view sub_milestones"
  ON sub_milestones FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view sub_milestones for own project"
  ON sub_milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM milestones m
      JOIN projects p ON p.id = m.project_id
      WHERE m.id = sub_milestones.milestone_id AND p.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage sub_milestones"
  ON sub_milestones FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update sub_milestones"
  ON sub_milestones FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete sub_milestones"
  ON sub_milestones FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sections (WBS grouping)
CREATE TABLE IF NOT EXISTS sections (
  id serial PRIMARY KEY,
  milestone_id integer NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  project_id integer NOT NULL REFERENCES projects(id),
  title text NOT NULL,
  start_date date,
  end_date date,
  completed boolean DEFAULT false,
  "order" integer DEFAULT 0
);

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view sections"
  ON sections FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage sections"
  ON sections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update sections"
  ON sections FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete sections"
  ON sections FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id integer REFERENCES milestones(id),
  section_id integer REFERENCES sections(id),
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo',
  assigned_to uuid REFERENCES profiles(id),
  start_date date,
  due_date date,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
