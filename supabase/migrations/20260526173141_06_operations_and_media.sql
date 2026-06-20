/*
  # Operations, Media, and Invite Tables

  1. New Tables
    - `time_entries` — crew timesheet entries with pay period tracking
    - `queued_sms` — business-hours SMS queue
    - `social_posts` — AI-generated social media content library
    - `paint_colors` — Benjamin Moore and other brand paint colors
    - `cinematic_reviews` — Ken-Burns / AI cinematic video renders
    - `room_renders` — AI room visualization renders
    - `table_redesign_plans` — furniture redesign planning tool
    - `table_redesign_materials` — materials list for redesign plans
    - `client_invites` — secure onboarding tokens for invited users

  2. Security
    - RLS on all tables
    - time_entries: crew can manage own; admin can manage all
    - paint_colors: admin/crew read; admin write
    - client_invites: admin managed
*/

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  task_id integer REFERENCES tasks(id),
  date date NOT NULL,
  hours text NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  description text,
  milestone_id integer REFERENCES milestones(id),
  calendar_event_id integer REFERENCES calendar_events(id),
  status text NOT NULL DEFAULT 'draft',
  pay_period_start date,
  pay_period_end date,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Crew can view own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Crew can insert own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Crew can update own draft time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update all time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Queued SMS
CREATE TABLE IF NOT EXISTS queued_sms (
  id serial PRIMARY KEY,
  to_phone text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  scheduled_for timestamptz,
  sent boolean DEFAULT false,
  sent_at timestamptz,
  error text
);

ALTER TABLE queued_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view queued SMS"
  ON queued_sms FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage queued SMS"
  ON queued_sms FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Social posts
CREATE TABLE IF NOT EXISTS social_posts (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  copy text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram',
  tone text DEFAULT 'Warm',
  photo_url text,
  photo_id integer,
  status text NOT NULL DEFAULT 'draft',
  source text DEFAULT 'manual',
  seen_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view social posts"
  ON social_posts FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage social posts"
  ON social_posts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update social posts"
  ON social_posts FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Paint colors
CREATE TABLE IF NOT EXISTS paint_colors (
  id serial PRIMARY KEY,
  brand text NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  hex text NOT NULL,
  color_family text NOT NULL,
  collection text,
  lrv integer,
  is_popular boolean DEFAULT false
);

ALTER TABLE paint_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view paint colors"
  ON paint_colors FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage paint colors"
  ON paint_colors FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Cinematic reviews
CREATE TABLE IF NOT EXISTS cinematic_reviews (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  board_id integer REFERENCES planning_boards(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  format text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  video_url text,
  thumbnail_url text,
  duration_sec real,
  error_message text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE cinematic_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view cinematic reviews"
  ON cinematic_reviews FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can manage cinematic reviews"
  ON cinematic_reviews FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update cinematic reviews"
  ON cinematic_reviews FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

-- Room renders
CREATE TABLE IF NOT EXISTS room_renders (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  board_id integer REFERENCES planning_boards(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  mode text NOT NULL,
  image_url text,
  thumbnail_url text,
  prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  cost_estimate_cents integer,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE room_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view room renders"
  ON room_renders FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can manage room renders"
  ON room_renders FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update room renders"
  ON room_renders FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

-- Table redesign plans
CREATE TABLE IF NOT EXISTS table_redesign_plans (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  piece_type text NOT NULL,
  piece_name text NOT NULL,
  before_image_url text,
  inspiration_image_url text,
  concept_image_url text,
  table_shape text NOT NULL,
  length_inches integer,
  width_inches integer,
  height_inches integer,
  thickness_inches integer,
  weight_class text NOT NULL DEFAULT 'unknown',
  existing_material text,
  redesign_scope text NOT NULL DEFAULT 'full',
  proposed_base_type text,
  style_direction text,
  finish_direction text,
  notes text,
  concept_title text,
  concept_description text,
  base_size_min_inches integer,
  base_size_max_inches integer,
  base_size_notes text,
  build_notes text,
  tag text,
  intended_use text,
  priority_constraint text,
  approval_status text NOT NULL DEFAULT 'draft',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE table_redesign_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view table redesign plans"
  ON table_redesign_plans FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage table redesign plans"
  ON table_redesign_plans FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update table redesign plans"
  ON table_redesign_plans FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Table redesign materials
CREATE TABLE IF NOT EXISTS table_redesign_materials (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL REFERENCES table_redesign_plans(id) ON DELETE CASCADE,
  component text NOT NULL,
  material text,
  finish text,
  dimensions text,
  quantity integer DEFAULT 1,
  notes text,
  supplier text,
  web_link text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE table_redesign_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view table redesign materials"
  ON table_redesign_materials FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage table redesign materials"
  ON table_redesign_materials FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update table redesign materials"
  ON table_redesign_materials FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Client invites
CREATE TABLE IF NOT EXISTS client_invites (
  id serial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  user_id uuid REFERENCES profiles(id),
  created_by uuid NOT NULL REFERENCES profiles(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view client invites"
  ON client_invites FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage client invites"
  ON client_invites FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update client invites"
  ON client_invites FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Public read on invite tokens for accept flow (unauthenticated)
CREATE POLICY "Anyone can read invite by token for accept flow"
  ON client_invites FOR SELECT
  TO anon
  USING (status = 'pending' AND expires_at > now());
