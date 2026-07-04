/**
 * Domain types for Supabase join queries and mapper functions.
 *
 * Row types (snake_case) live in database.types.ts as the source of truth.
 * This file adds:
 *  1. Composite types for queries that join related tables.
 *  2. Patch-shape helpers that replace `as any` in update/insert calls.
 */

import type {
  Database,
  Profile,
  Project,
  Milestone,
  SubMilestone,
  Task,
  Photo,
  Document,
  Message,
  Decision,
  ChangeOrder,
  SiteVisit,
  Selection,
  WishlistItem,
  FeatureFlag,
  ClientInvite,
} from "@/shared/database.types";

// ── Patch shape helpers ────────────────────────────────────────────────────
// These narrow `as any` casts to specific, verified Update shapes.

export type PlanningBoardPatch = Database["public"]["Tables"]["planning_boards"]["Update"];
export type MilestonePatch = Database["public"]["Tables"]["milestones"]["Update"];
export type SubMilestonePatch = Database["public"]["Tables"]["sub_milestones"]["Update"];
export type CalendarEventPatch = Database["public"]["Tables"]["calendar_events"]["Update"];
export type BoardSnapshotPatch = Database["public"]["Tables"]["board_snapshots"]["Update"];
export type ProjectPatch = Database["public"]["Tables"]["projects"]["Update"];
export type TenantSettingsPatch = Database["public"]["Tables"]["tenant_settings"]["Update"];
export type TenantSettingsInsert = Database["public"]["Tables"]["tenant_settings"]["Insert"];
export type ClientInviteInsert = Database["public"]["Tables"]["client_invites"]["Insert"];
export type FeatureFlagPatch = Database["public"]["Tables"]["feature_flags"]["Update"];
export type TaskPatch = Database["public"]["Tables"]["tasks"]["Update"];
export type SelectionPatch = Database["public"]["Tables"]["selections"]["Update"];

// ── Join / composite types ────────────────────────────────────────────────
// These represent the shapes returned by Supabase queries that embed
// related rows (via PostgREST foreign-key expansion).

/** Project row with an optional embedded client profile. */
export type ProjectWithClient = Project & {
  client: Pick<Profile, "name" | "email" | "avatar_url"> | null;
};

/** Milestone row with nested sub-milestones. */
export type MilestoneWithSubs = Milestone & {
  sub_milestones: SubMilestone[];
};

/** Task row with an optional embedded assignee profile. */
export type TaskWithAssignee = Task & {
  assignee: Pick<Profile, "name" | "avatar_url"> | null;
};

/** Message row with an optional embedded sender profile. */
export type MessageWithSender = Message & {
  sender: Pick<Profile, "name" | "avatar_url"> | null;
};

/** SiteVisit row with optional embedded user profile. */
export type SiteVisitWithUser = SiteVisit & {
  user: Pick<Profile, "name"> | null;
};

/** WishlistItem row with optional embedded user profile. */
export type WishlistItemWithUser = WishlistItem & {
  user: Pick<Profile, "name" | "avatar_url"> | null;
};

// Re-export plain Row types so importers only need this one module for
// domain-layer types (instead of also importing from database.types).
export type {
  Profile,
  Project,
  Milestone,
  SubMilestone,
  Task,
  Photo,
  Document,
  Message,
  Decision,
  ChangeOrder,
  SiteVisit,
  Selection,
  WishlistItem,
  FeatureFlag,
  ClientInvite,
};

// ── Mapper functions ──────────────────────────────────────────────────────
// Cast raw query results to their typed composite shapes at the query boundary.

export function asProjectWithClient(raw: unknown): ProjectWithClient {
  return raw as ProjectWithClient;
}

export function asMilestoneWithSubs(raw: unknown): MilestoneWithSubs {
  return raw as MilestoneWithSubs;
}

export function asTaskWithAssignee(raw: unknown): TaskWithAssignee {
  return raw as TaskWithAssignee;
}

export function asMessageWithSender(raw: unknown): MessageWithSender {
  return raw as MessageWithSender;
}

export function asSiteVisitWithUser(raw: unknown): SiteVisitWithUser {
  return raw as SiteVisitWithUser;
}

export function asWishlistItemWithUser(raw: unknown): WishlistItemWithUser {
  return raw as WishlistItemWithUser;
}
