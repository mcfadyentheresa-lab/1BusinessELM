import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../migrations");

/**
 * Migration files that only touch schemas Supabase manages outside of
 * `public` (storage, pg_net) - not present in this bare-Postgres harness
 * and irrelevant to the estimate persistence/RLS logic under test here.
 * Verified by inspection that each file's CREATE/ALTER/DROP statements are
 * scoped entirely to storage.* objects or the pg_net extension.
 */
const SKIP_MIGRATIONS = new Set([
  "20260608003622_create_project_assets_storage_bucket.sql",
  "20260620180121_fix_storage_policy_and_rpc_exposure.sql",
  "20260620180317_fix_storage_listing_and_public_rpc_execute.sql",
  "20260802221607_tmp_verify_storage_buckets_select.sql",
  "20260802221717_tmp_verify_remove_buckets_select.sql",
  "20260802222401_fix_storage_buckets_select_policy.sql",
  "20260802222655_tmp_cleanup_select_test_objects.sql",
  "20260802222706_tmp_cleanup_remove_select_policy.sql",
  "20260802231354_tmp_cleanup_select_test_pdfs.sql",
  "20260802231407_tmp_cleanup_remove_pdf_select_policy.sql",
  "20260818120100_fix_storage_objects_update_delete_ownership.sql",
  "20260720010253_enable_pg_net.sql",
]);

/**
 * A minimal stand-in for what Supabase provisions outside our migrations:
 * the `auth` schema, `auth.uid()`/`auth.jwt()` reading the same
 * `request.jwt.claims` GUC that PostgREST sets in production, and the
 * `authenticated`/`anon` roles our RLS policies grant to.
 */
const AUTH_STUB = `
  create schema auth;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    raw_app_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  $$;

  create or replace function auth.uid() returns uuid
  language sql stable
  as $$
    select (auth.jwt() ->> 'sub')::uuid;
  $$;

  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role;
    end if;
  end $$;

  grant usage on schema auth to authenticated, anon, service_role;
  grant usage on schema public to authenticated, anon, service_role;

  -- Supabase's platform bootstrap grants these baseline table/sequence/
  -- routine privileges outside of any user migration - RLS policies then
  -- further restrict what's actually reachable. Applied as DEFAULT
  -- PRIVILEGES so every table/function our migrations go on to create
  -- picks them up automatically, same as production.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
`;

function loadMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !SKIP_MIGRATIONS.has(f))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name), "utf-8") }));
}

/**
 * Builds a fresh in-memory Postgres (via PGlite - real Postgres compiled to
 * WASM, no Docker required) and replays every real migration this project
 * has ever shipped, in order, against it - so tests exercise the actual
 * schema/RLS/function SQL that ships to production, not a hand-written
 * approximation of it.
 */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const { name, sql } of loadMigrations()) {
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migration ${name} failed against the test harness: ${(err as Error).message}`);
    }
  }
  return db;
}

export interface TestUser {
  id: string;
  email: string;
  role: "admin" | "crew" | "client";
}

/**
 * Seeds an auth.users + profiles row for a test identity. Goes through the
 * real `handle_new_user` trigger path (insert into auth.users) rather than
 * inserting into profiles directly, so the same app_metadata-sync trigger
 * that runs in production also runs here.
 */
export async function seedUser(db: PGlite, user: TestUser): Promise<void> {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
    [user.id, user.email, JSON.stringify({ role: user.role, name: user.email })]
  );
  await db.query(`update public.profiles set role = $1 where id = $2`, [user.role, user.id]);
}

/**
 * Runs `fn` inside a transaction impersonating `userId` as the
 * `authenticated` role - the same BEGIN / SET LOCAL ROLE / SET LOCAL
 * request.jwt.claims pattern used for this project's live production
 * verification, just automated. Rolls back by default so tests never leak
 * state into each other even on failure; pass `{ commit: true }` for fixture
 * setup that a later, separate asUser() call needs to see.
 */
export async function asUser<T>(
  db: PGlite,
  user: TestUser,
  fn: () => Promise<T>,
  opts: { commit?: boolean } = {}
): Promise<T> {
  await db.exec("begin;");
  await db.exec("set local role authenticated;");
  await db.query(`select set_config('request.jwt.claims', $1, true);`, [
    JSON.stringify({ sub: user.id, role: "authenticated", app_metadata: { role: user.role } }),
  ]);
  try {
    const result = await fn();
    await db.exec(opts.commit ? "commit;" : "rollback;");
    return result;
  } catch (err) {
    await db.exec("rollback;");
    throw err;
  }
}

/** Fixture helper: a project + a draft estimate on it, inserted directly (bypassing RLS, same as any test fixture setup). */
export async function seedDraftEstimate(db: PGlite): Promise<{ projectId: number; estimateId: number }> {
  const proj = await db.query<{ id: number }>(`insert into public.projects (name) values ('Test Project') returning id`);
  const projectId = proj.rows[0].id;
  const est = await db.query<{ id: number }>(
    `insert into public.project_estimates (project_id, status) values ($1, 'draft') returning id`,
    [projectId]
  );
  return { projectId, estimateId: est.rows[0].id };
}
