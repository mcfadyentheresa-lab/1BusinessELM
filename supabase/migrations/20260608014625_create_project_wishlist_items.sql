-- Wishlist: per-project items saved by clients (visible to admin too)
CREATE TABLE project_wishlist_items (
  id          serial PRIMARY KEY,
  project_id  int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  note        text,
  image_url   text,
  source_url  text,
  category    text,   -- e.g. 'colour', 'material', 'furniture', 'fixture', 'other'
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_wishlist_items ENABLE ROW LEVEL SECURITY;

-- Clients can select items for their own project
CREATE POLICY "select_own_wishlist" ON project_wishlist_items
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'crew')
    )
  );

-- Authenticated users can insert items linked to a project they belong to
CREATE POLICY "insert_own_wishlist" ON project_wishlist_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own items; admins can update any
CREATE POLICY "update_own_wishlist" ON project_wishlist_items
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Users can delete their own items; admins can delete any
CREATE POLICY "delete_own_wishlist" ON project_wishlist_items
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Also add role column to client_invites if it doesn't exist yet
ALTER TABLE client_invites ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client';
