import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, seedUser, seedDraftEstimate, asUser, type TestUser } from "./db";

/**
 * Real regression coverage for the approve/unlock/audit-trail feature and
 * the RLS lock it enforces (ESTIMATE_AUDIT.md §1, item 13) - previously
 * verified only by hand, once, in the Supabase SQL Editor against
 * production. See ./db.ts for how the harness replays real migrations.
 */
describe("approve_estimate / unlock_estimate", () => {
  let db: PGlite;

  const ADMIN: TestUser = { id: "11111111-1111-1111-1111-111111111111", email: "admin@test.local", role: "admin" };
  const CREW: TestUser = { id: "22222222-2222-2222-2222-222222222222", email: "crew@test.local", role: "crew" };
  // Never seeded - get_my_role() returns NULL, reproducing the exact bug
  // this session caught live: `<> 'admin'` silently passes for NULL.
  const GHOST: TestUser = { id: "99999999-9999-9999-9999-999999999999", email: "ghost@test.local", role: "client" };

  beforeAll(async () => {
    db = await createTestDb();
    await seedUser(db, ADMIN);
    await seedUser(db, CREW);
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  async function seedApprovedEstimate() {
    const { projectId, estimateId } = await seedDraftEstimate(db);
    await db.query(
      `insert into public.estimate_items (estimate_id, unit_type, quantity, unit_cost, material_cost) values ($1, 'sq_ft', '10', '20', '5')`,
      [estimateId]
    );
    await asUser(
      db,
      ADMIN,
      async () => {
        await db.query(`select public.approve_estimate($1)`, [estimateId]);
      },
      { commit: true }
    );
    return { projectId, estimateId };
  }

  it("lets an admin approve a draft estimate and snapshots it", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await db.query(
      `insert into public.estimate_items (estimate_id, unit_type, quantity, unit_cost, material_cost) values ($1, 'sq_ft', '10', '20', '5')`,
      [estimateId]
    );

    await asUser(db, ADMIN, async () => {
      await db.query(`select public.approve_estimate($1)`, [estimateId]);

      const estimate = await db.query<{ status: string; approved_by: string }>(
        `select status, approved_by from public.project_estimates where id = $1`,
        [estimateId]
      );
      expect(estimate.rows[0].status).toBe("approved");
      expect(estimate.rows[0].approved_by).toBe(ADMIN.id);

      const history = await db.query<{
        action: string;
        performed_by: string;
        snapshot: { items: Array<{ quantity: string }> };
      }>(
        `select action, performed_by, snapshot from public.estimate_status_history where estimate_id = $1`,
        [estimateId]
      );
      expect(history.rows).toHaveLength(1);
      const row = history.rows[0];
      expect(row.action).toBe("approved");
      expect(row.performed_by).toBe(ADMIN.id);
      expect(row.snapshot.items).toHaveLength(1);
      expect(row.snapshot.items[0].quantity).toBe("10");
    });
  });

  it("rejects approval from a non-admin", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, CREW, async () => {
      await expect(db.query(`select public.approve_estimate($1)`, [estimateId])).rejects.toThrow(/only admins/i);
    });
  });

  it("rejects approval from an identity with no profile row (NULL role)", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, GHOST, async () => {
      await expect(db.query(`select public.approve_estimate($1)`, [estimateId])).rejects.toThrow(/only admins/i);
    });
  });

  it("lets an admin unlock an approved estimate with a reason, logging it", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.unlock_estimate($1, $2)`, [estimateId, "Client requested a change to the flooring line item"]);

      const estimate = await db.query<{ status: string }>(
        `select status from public.project_estimates where id = $1`,
        [estimateId]
      );
      expect(estimate.rows[0].status).toBe("draft");

      const history = await db.query<{ reason: string; performed_by: string }>(
        `select action, reason, performed_by from public.estimate_status_history where estimate_id = $1 and action = 'unlocked'`,
        [estimateId]
      );
      expect(history.rows).toHaveLength(1);
      expect(history.rows[0].reason).toBe("Client requested a change to the flooring line item");
      expect(history.rows[0].performed_by).toBe(ADMIN.id);
    });
  });

  it("rejects an unlock with an empty reason", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      await expect(db.query(`select public.unlock_estimate($1, $2)`, [estimateId, ""])).rejects.toThrow(/reason is required/i);
    });
  });

  it("rejects an unlock with a whitespace-only reason", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      await expect(db.query(`select public.unlock_estimate($1, $2)`, [estimateId, "   "])).rejects.toThrow(/reason is required/i);
    });
  });

  it("rejects unlock from a non-admin", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, CREW, async () => {
      await expect(db.query(`select public.unlock_estimate($1, $2)`, [estimateId, "trying to sneak this through"])).rejects.toThrow(/only admins/i);
    });
  });

  it("blocks direct writes to an approved estimate's settings, even for an admin (RLS defense in depth)", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      const result = await db.query(`update public.project_estimates set markup_percent = '999' where id = $1`, [estimateId]);
      expect(result.affectedRows ?? 0).toBe(0);

      const check = await db.query<{ markup_percent: string }>(
        `select markup_percent from public.project_estimates where id = $1`,
        [estimateId]
      );
      expect(check.rows[0].markup_percent).not.toBe("999");
    });
  });

  it("blocks direct inserts into an approved estimate's line items, even for an admin (RLS defense in depth)", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      await expect(
        db.query(
          `insert into public.estimate_items (estimate_id, unit_type, quantity, unit_cost, material_cost) values ($1, 'sq_ft', '1', '1', '0')`,
          [estimateId]
        )
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("blocks direct deletes of an approved estimate's line items, even for an admin (RLS defense in depth)", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      const before = await db.query(`select id from public.estimate_items where estimate_id = $1`, [estimateId]);
      expect(before.rows.length).toBeGreaterThan(0);

      const result = await db.query(`delete from public.estimate_items where estimate_id = $1`, [estimateId]);
      expect(result.affectedRows ?? 0).toBe(0);

      const after = await db.query(`select id from public.estimate_items where estimate_id = $1`, [estimateId]);
      expect(after.rows.length).toBe(before.rows.length);
    });
  });

  it("keeps estimate_status_history append-only - no UPDATE/DELETE policy exists, even for an admin", async () => {
    const { estimateId } = await seedApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      const before = await db.query(`select id, action, reason from public.estimate_status_history where estimate_id = $1`, [estimateId]);
      expect(before.rows).toHaveLength(1);

      const updateResult = await db.query(`update public.estimate_status_history set reason = 'tampered' where estimate_id = $1`, [estimateId]);
      expect(updateResult.affectedRows ?? 0).toBe(0);

      const deleteResult = await db.query(`delete from public.estimate_status_history where estimate_id = $1`, [estimateId]);
      expect(deleteResult.affectedRows ?? 0).toBe(0);

      const after = await db.query(`select id, action, reason from public.estimate_status_history where estimate_id = $1`, [estimateId]);
      expect(after.rows).toEqual(before.rows);
    });
  });
});
