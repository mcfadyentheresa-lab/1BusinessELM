/*
# Add is_mockup column to canvas_elements

## Purpose
New planning boards auto-populate with a starter mock-up layout so users have
something to react to instead of a blank canvas. Auto-generated starter elements
are flagged with `is_mockup = true`. The moment a user edits an element (move,
resize, or content edit), the flag is cleared to false — once touched, the element
is treated as real content and is protected from bulk mock-up actions
("Clear mock-up" and "Randomize").

## Changes
1. New column
   - `canvas_elements.is_mockup` (boolean, NOT NULL, DEFAULT false)
   - Existing rows default to false, so all pre-existing elements are treated as
     real content and are never swept by mock-up bulk actions.

## Security
- No RLS policy changes. The column is covered by the existing canvas_elements
  CRUD policies (owner-scoped via board membership).
- No new tables, no foreign keys, no indexes needed (mockup elements are
  filtered client-side; the set per board is small).

## Notes
1. Idempotent: uses `ADD COLUMN IF NOT EXISTS` so re-running is safe.
2. No data loss: the column is additive with a safe default.
3. The frontend reads/writes this column through the existing Supabase client;
   no new API routes are introduced.
*/

ALTER TABLE canvas_elements
  ADD COLUMN IF NOT EXISTS is_mockup boolean NOT NULL DEFAULT false;