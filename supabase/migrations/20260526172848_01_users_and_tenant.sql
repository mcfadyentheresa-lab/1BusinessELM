/*
  # Users, Tenant Settings, and Feature Flags

  1. New Tables
    - `profiles` — extends auth.users with app-specific fields (role, phone, avatar, name)
    - `tenant_settings` — single-row company brand + SMS configuration
    - `feature_flags` — per-tenant feature toggles for staged rollouts

  2. Security
    - RLS enabled on all tables
    - Users can read/update their own profile
    - Admins can read all profiles
    - tenant_settings readable by authenticated users; writable by admin only
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'crew', -- admin | crew | client
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Tenant settings
CREATE TABLE IF NOT EXISTS tenant_settings (
  id serial PRIMARY KEY,
  tenant_key text NOT NULL UNIQUE DEFAULT 'default',
  brand_name text NOT NULL DEFAULT 'Aster & Spruce',
  brand_website text DEFAULT 'https://asterandspruceliving.ca',
  support_email text DEFAULT 'info@asterandspruceliving.ca',
  legal_name text,
  logo_url text,
  primary_color text,
  app_url text,
  sms_enabled boolean NOT NULL DEFAULT false,
  sms_invites_enabled boolean NOT NULL DEFAULT true,
  sms_require_approval boolean NOT NULL DEFAULT true,
  sms_quiet_hours_start integer NOT NULL DEFAULT 9,
  sms_quiet_hours_end integer NOT NULL DEFAULT 19,
  sms_quiet_hours_days jsonb NOT NULL DEFAULT '[1,2,3,4,5]',
  timezone text NOT NULL DEFAULT 'America/Toronto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tenant settings"
  ON tenant_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update tenant settings"
  ON tenant_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Insert default tenant settings
INSERT INTO tenant_settings (tenant_key) VALUES ('default') ON CONFLICT (tenant_key) DO NOTHING;

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id serial PRIMARY KEY,
  tenant_key text NOT NULL DEFAULT 'default',
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_key, flag_key)
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage feature flags"
  ON feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update feature flags"
  ON feature_flags FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'crew')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
