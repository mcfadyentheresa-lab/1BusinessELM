/*
# Add priority column to watcher_alerts

1. Changes
- Adds a `priority` column (text, NOT NULL, default 'attention') to `watcher_alerts`.
- CHECK constraint limits values to 'critical', 'attention', 'watch'.
- Existing rows backfilled to 'attention' via the column DEFAULT.
- No other columns or tables are modified.
- No RLS changes — watcher_alerts already has RLS enabled.

2. Priority levels
- 'critical' — budget overage, requires immediate attention
- 'attention' — approaching a limit or unresolved issue, should be reviewed soon
- 'watch' — stale but not urgent, monitor the situation
*/

ALTER TABLE watcher_alerts
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'attention'
  CHECK (priority IN ('critical', 'attention', 'watch'));