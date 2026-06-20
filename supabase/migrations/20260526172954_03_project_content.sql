/*
  # Project Content Tables

  1. New Tables
    - `photos` — project photos with tags, showcase/before-after flags
    - `documents` — contracts, invoices, plans, change orders
    - `messages` — project chat messages
    - `checklist_items` — collaborative wish-list/to-do items
    - `calendar_events` — shared project calendar events
    - `activity_log` — audit trail of all project actions
    - `activity_views` — tracks who has seen each activity entry
    - `decisions` — permanent record of choices made on a project
    - `change_orders` — signed financial/scope changes to the contract
    - `site_visits` — operational site visit log
    - `selections` — ledger of specified/ordered/installed items

  2. Security
    - RLS on all tables
    - Admins/crew full access; clients read-only on their project content
*/

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  tags text[],
  is_showcase boolean DEFAULT false,
  is_before_after boolean DEFAULT false,
  planning_board_id integer,
  inspiration boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view photos"
  ON photos FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project photos"
  ON photos FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = photos.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can insert photos"
  ON photos FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update photos"
  ON photos FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete photos"
  ON photos FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project documents"
  ON documents FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Messages (project chat)
CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew'))
    OR EXISTS (SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.client_id = auth.uid())
  );

CREATE POLICY "Project members can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew'))
      OR EXISTS (SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.client_id = auth.uid())
    )
  );

-- Checklist items
CREATE TABLE IF NOT EXISTS checklist_items (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  notes text,
  price_estimate integer,
  priority text DEFAULT 'normal',
  "group" text DEFAULT 'General',
  status text DEFAULT 'todo',
  color text,
  requires_client boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view checklist items"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project checklist items"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = checklist_items.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can manage checklist items"
  ON checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update checklist items"
  ON checklist_items FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete checklist items"
  ON checklist_items FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  date date NOT NULL,
  end_date date,
  type text DEFAULT 'event',
  image_url text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = calendar_events.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can manage calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  type text NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view activity log"
  ON activity_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can insert activity log"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

-- Activity views
CREATE TABLE IF NOT EXISTS activity_views (
  id serial PRIMARY KEY,
  activity_id integer NOT NULL REFERENCES activity_log(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  viewed_at timestamptz DEFAULT now()
);

ALTER TABLE activity_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity views"
  ON activity_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activity views"
  ON activity_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Decisions
CREATE TABLE IF NOT EXISTS decisions (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  decision text NOT NULL,
  context text,
  decided_on date NOT NULL,
  decided_by uuid REFERENCES profiles(id),
  category text,
  related_milestone_id integer REFERENCES milestones(id),
  attachment_photo_id integer,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view decisions"
  ON decisions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project decisions"
  ON decisions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = decisions.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can manage decisions"
  ON decisions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update decisions"
  ON decisions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete decisions"
  ON decisions FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Change orders
CREATE TABLE IF NOT EXISTS change_orders (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL,
  description text,
  amount text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  sent_on date,
  decided_on date,
  decided_by uuid REFERENCES profiles(id),
  notes text,
  attachment_document_id integer,
  archived boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view change orders"
  ON change_orders FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view non-draft change orders"
  ON change_orders FOR SELECT
  TO authenticated
  USING (
    status != 'draft' AND
    EXISTS (SELECT 1 FROM projects WHERE projects.id = change_orders.project_id AND projects.client_id = auth.uid())
  );

CREATE POLICY "Admins can manage change orders"
  ON change_orders FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update change orders"
  ON change_orders FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Site visits
CREATE TABLE IF NOT EXISTS site_visits (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  visited_on date NOT NULL,
  visit_type text NOT NULL DEFAULT 'routine',
  attendees text,
  summary text NOT NULL,
  follow_ups text,
  weather text,
  archived boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view site visits"
  ON site_visits FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project site visits"
  ON site_visits FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = site_visits.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can manage site visits"
  ON site_visits FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update site visits"
  ON site_visits FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

-- Selections ledger
CREATE TABLE IF NOT EXISTS selections (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room text,
  category text,
  item text NOT NULL,
  product text,
  vendor text,
  sku text,
  quantity text,
  status text NOT NULL DEFAULT 'proposed',
  lead_time_days integer,
  ordered_on date,
  expected_on date,
  installed_on date,
  notes text,
  attachment_photo_id integer,
  related_decision_id integer REFERENCES decisions(id),
  archived boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view selections"
  ON selections FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Clients can view own project selections"
  ON selections FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = selections.project_id AND projects.client_id = auth.uid()));

CREATE POLICY "Admins and crew can manage selections"
  ON selections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins and crew can update selections"
  ON selections FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can delete selections"
  ON selections FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
