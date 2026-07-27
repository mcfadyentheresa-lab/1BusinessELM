-- Add region column to projects (nullable, no default — existing rows stay null)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS region text;