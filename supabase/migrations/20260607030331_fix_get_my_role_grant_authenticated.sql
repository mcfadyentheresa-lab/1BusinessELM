
-- Re-grant EXECUTE on get_my_role to authenticated so RLS policies work
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;
