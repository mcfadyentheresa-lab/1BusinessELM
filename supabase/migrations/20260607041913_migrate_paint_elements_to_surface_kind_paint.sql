/*
  # Migrate 'paint' canvas element type to 'surface' with kind='paint'

  The PlanningBoard renderer handles paint swatches as type='surface' with content.kind='paint'.
  Seed data was inserted with type='paint' which has no renderer (falls through to null).
  Migrate these elements so they render correctly.
*/

UPDATE canvas_elements
SET
  type = 'surface',
  content = content || '{"kind":"paint"}'::jsonb
WHERE type = 'paint';
