/*
# Fix client_invites.project_id to be nullable

## Context
The client_invites table has project_id as NOT NULL with a FK to projects(id).
This breaks crew/admin invites, which are not scoped to a specific project.
Only client invites should require a project_id.

## Changes
1. ALTER TABLE client_invites ALTER COLUMN project_id DROP NOT NULL
   - Makes project_id nullable so crew/admin invites can store NULL
   - Client invites will still provide a real project_id from the dialog

## Security
- No RLS changes. Existing policies remain intact.
*/

ALTER TABLE public.client_invites ALTER COLUMN project_id DROP NOT NULL;