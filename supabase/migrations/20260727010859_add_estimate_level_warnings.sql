/*
# Add estimate-level audit warnings

## Purpose
The estimate_warnings table previously required every warning to attach to a
specific estimate_item (estimate_item_id was NOT NULL). This migration adds
support for warnings that apply to an entire estimate (e.g. "estimate total
exceeds budget by 20%"), not just a single line item.

## Changes
1. estimate_warnings.estimate_item_id — changed from NOT NULL to nullable
   (warnings can now attach to either an item OR a whole estimate)
2. New column: estimate_id (integer, nullable) — FK to project_estimates(id)
3. New CHECK constraint: at least one of estimate_item_id or estimate_id
   must be non-null (a warning must always attach to something)
4. New index on estimate_id for query performance
5. RLS policies dropped and recreated with identical logic
   (get_my_role() = 'admin' — admin-only access for SELECT/INSERT/UPDATE)
   No change to access rules needed: the existing policies use a simple
   role check, not FK-path traversal, so both item-level and estimate-level
   warnings are covered automatically.

## Security
- RLS remains enabled (was already enabled)
- Policies remain admin-only via get_my_role() = 'admin'
- No DELETE policy (unchanged — warnings are dismissed via UPDATE, not deleted)
*/