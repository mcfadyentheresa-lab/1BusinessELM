-- Backfill estimate_id on existing item-level warnings that were inserted
-- with estimate_id = NULL (before the edge function fix). Derives the
-- estimate_id from the linked estimate_items row.
UPDATE estimate_warnings w
SET estimate_id = ei.estimate_id
FROM estimate_items ei
WHERE w.estimate_item_id = ei.id
  AND w.estimate_id IS NULL;