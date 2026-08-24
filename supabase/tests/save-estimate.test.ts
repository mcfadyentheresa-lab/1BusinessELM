import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, seedUser, seedDraftEstimate, asUser, type TestUser } from "./db";

/**
 * Real regression coverage for save_estimate's atomicity and error-checking
 * (ESTIMATE_AUDIT.md item 9) and its input validation (item 10) - the exact
 * two properties that were manually verified live in production this
 * engagement but had zero automated protection until now (item 13).
 *
 * Runs against a real Postgres (PGlite/WASM) with every actual migration
 * this project ships replayed against it - see ./db.ts.
 */
describe("save_estimate", () => {
  let db: PGlite;

  const ADMIN: TestUser = { id: "11111111-1111-1111-1111-111111111111", email: "admin@test.local", role: "admin" };
  const CREW: TestUser = { id: "22222222-2222-2222-2222-222222222222", email: "crew@test.local", role: "crew" };
  // Deliberately never seeded - get_my_role() returns NULL for this identity,
  // reproducing the exact NULL-comparison bug caught live this engagement
  // (`<> 'admin'` silently passing for NULL; must be `IS DISTINCT FROM`).
  const GHOST: TestUser = { id: "99999999-9999-9999-9999-999999999999", email: "ghost@test.local", role: "client" };

  beforeAll(async () => {
    db = await createTestDb();
    await seedUser(db, ADMIN);
    await seedUser(db, CREW);
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  it("saves valid line items", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
        estimateId,
        false,
        "0",
        "0",
        false,
        "0",
        JSON.stringify([{ quantity: "10", unit_type: "sq_ft", unit_cost: "20", material_cost: "5" }]),
      ]);
      const items = await db.query<{ quantity: string; unit_cost: string; material_cost: string }>(
        `select quantity, unit_cost, material_cost from public.estimate_items where estimate_id = $1`,
        [estimateId]
      );
      expect(items.rows).toEqual([{ quantity: "10", unit_cost: "20", material_cost: "5" }]);
    });
  });

  it("replaces the full item set on every save (delete-then-insert)", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
        estimateId, false, "0", "0", false, "0",
        JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
      ]);
      await db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
        estimateId, false, "0", "0", false, "0",
        JSON.stringify([
          { quantity: "2", unit_type: "sq_ft", unit_cost: "2", material_cost: "0" },
          { quantity: "3", unit_type: "sq_ft", unit_cost: "3", material_cost: "0" },
        ]),
      ]);
      const items = await db.query<{ quantity: string }>(
        `select quantity from public.estimate_items where estimate_id = $1 order by quantity`,
        [estimateId]
      );
      expect(items.rows.map((r) => r.quantity)).toEqual(["2", "3"]);
    });
  });

  it("rolls back the whole save when the insert fails partway (atomicity)", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      // Seed one real item first.
      await db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
        estimateId, false, "0", "0", false, "0",
        JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
      ]);

      // Second save: one good item plus one with a nonexistent assembly_id,
      // which violates a foreign key partway through the insert. A failed
      // statement aborts the rest of the surrounding Postgres transaction,
      // so this needs its own savepoint to let the outer asUser() rollback
      // and the assertions below still run cleanly.
      await db.exec("savepoint sp1;");
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, false, "0", "0", false, "0",
          JSON.stringify([
            { quantity: "5", unit_type: "sq_ft", unit_cost: "5", material_cost: "0" },
            { quantity: "5", unit_type: "sq_ft", unit_cost: "5", material_cost: "0", assembly_id: "999999" },
          ]),
        ])
      ).rejects.toThrow();
      await db.exec("rollback to savepoint sp1;");

      // The delete inside the failed transaction must have rolled back too -
      // this is the exact bug fix from item 9: before it, a failed insert
      // after a successful delete silently left the estimate with zero items.
      const items = await db.query<{ quantity: string }>(
        `select quantity from public.estimate_items where estimate_id = $1`,
        [estimateId]
      );
      expect(items.rows).toHaveLength(1);
      expect(items.rows[0].quantity).toBe("1");
    });
  });

  it("rejects a non-admin caller", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, CREW, async () => {
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, false, "0", "0", false, "0",
          JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
        ])
      ).rejects.toThrow(/only admins/i);
    });
  });

  it("rejects a caller with no profile row (NULL role) instead of silently passing", async () => {
    // Regression: get_my_role() returns NULL here; `<> 'admin'` evaluates to
    // NULL (falsy to IF) and used to let this through. Must use IS DISTINCT FROM.
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, GHOST, async () => {
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, false, "0", "0", false, "0",
          JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
        ])
      ).rejects.toThrow(/only admins/i);
    });
  });

  it("rejects a garbage quantity", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, false, "0", "0", false, "0",
          JSON.stringify([{ quantity: "abc", unit_type: "sq_ft", unit_cost: "10", material_cost: "5" }]),
        ])
      ).rejects.toThrow(/invalid quantity/i);
    });
  });

  it("rejects a negative unit cost", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, false, "0", "0", false, "0",
          JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "-10", material_cost: "5" }]),
        ])
      ).rejects.toThrow(/invalid quantity/i);
    });
  });

  it("rejects a garbage markup percentage", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, true, "abc", "0", false, "0",
          JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
        ])
      ).rejects.toThrow(/contingency, markup, and management fee/i);
    });
  });

  it("rejects a negative contingency percentage", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, false, "0", "-10", false, "0",
          JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
        ])
      ).rejects.toThrow(/contingency, markup, and management fee/i);
    });
  });

  it("allows empty-string percentages (falls back to 0 downstream)", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
        estimateId, true, "", "", false, "",
        JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
      ]);
      const estimate = await db.query(`select markup_percent, contingency_percent, management_fee_percent from public.project_estimates where id = $1`, [estimateId]);
      expect(estimate.rows[0]).toEqual({ markup_percent: "", contingency_percent: "", management_fee_percent: "" });
    });
  });

  it("allows empty-string quantity/cost fields (a placeholder item)", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
        estimateId, false, "0", "0", false, "0",
        JSON.stringify([{ quantity: "", unit_type: "sq_ft", unit_cost: "", material_cost: "" }]),
      ]);
      const items = await db.query(`select quantity, unit_cost, material_cost from public.estimate_items where estimate_id = $1`, [estimateId]);
      expect(items.rows).toEqual([{ quantity: "", unit_cost: "", material_cost: "" }]);
    });
  });

  it("rejects saving once the estimate is approved", async () => {
    const { estimateId } = await seedDraftEstimate(db);
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.approve_estimate($1)`, [estimateId]);
      await expect(
        db.query(`select public.save_estimate($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
          estimateId, false, "0", "0", false, "0",
          JSON.stringify([{ quantity: "1", unit_type: "sq_ft", unit_cost: "1", material_cost: "0" }]),
        ])
      ).rejects.toThrow(/locked/i);
    });
  });
});
