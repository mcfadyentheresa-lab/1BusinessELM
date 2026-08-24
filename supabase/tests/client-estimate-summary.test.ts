import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, seedUser, asUser, type TestUser } from "./db";

/**
 * Coverage for get_client_estimate_summary (ESTIMATE_AUDIT.md item 8):
 * clients see the rooms covered and the final approved total, never the
 * per-item cost breakdown, and never a draft that hasn't been approved yet.
 */
describe("get_client_estimate_summary", () => {
  let db: PGlite;

  const ADMIN: TestUser = { id: "11111111-1111-1111-1111-111111111111", email: "admin@test.local", role: "admin" };
  const CLIENT: TestUser = { id: "33333333-3333-3333-3333-333333333333", email: "client@test.local", role: "client" };
  const OTHER_CLIENT: TestUser = { id: "44444444-4444-4444-4444-444444444444", email: "other@test.local", role: "client" };

  beforeAll(async () => {
    db = await createTestDb();
    await seedUser(db, ADMIN);
    await seedUser(db, CLIENT);
    await seedUser(db, OTHER_CLIENT);
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  async function seedClientProjectWithApprovedEstimate() {
    const proj = await db.query<{ id: number }>(
      `insert into public.projects (name, client_id) values ('Client Reno', $1) returning id`,
      [CLIENT.id]
    );
    const projectId = proj.rows[0].id;
    const est = await db.query<{ id: number }>(
      `insert into public.project_estimates (project_id, status, markup_enabled, contingency_percent) values ($1, 'draft', false, '0') returning id`,
      [projectId]
    );
    const estimateId = est.rows[0].id;
    await db.query(
      `insert into public.estimate_items (estimate_id, room, unit_type, quantity, unit_cost, material_cost) values
        ($1, 'Kitchen', 'sq_ft', '10', '20', '5'),
        ($1, 'Bathroom', 'hour', '4', '100', '0')`,
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

  it("returns rooms and the final total, not per-item costs", async () => {
    const { projectId } = await seedClientProjectWithApprovedEstimate();
    await asUser(db, CLIENT, async () => {
      const result = await db.query<{ get_client_estimate_summary: { approved_at: string; total: string; rooms: string[] } }>(
        `select public.get_client_estimate_summary($1)`,
        [projectId]
      );
      const summary = result.rows[0].get_client_estimate_summary;
      expect(summary).not.toBeNull();
      expect(summary.rooms.sort()).toEqual(["Bathroom", "Kitchen"]);
      // (10*(20+5)) + (4*(100+0)) = 250 + 400 = 650 subtotal, no
      // contingency/markup/mgmt fee enabled by default on this fixture.
      expect(Number(summary.total)).toBe(650);
      expect(summary).not.toHaveProperty("unit_cost");
      expect(summary).not.toHaveProperty("items");
    });
  });

  it("computes the total through contingency/markup/management fee, matching computeEstimateTotals", async () => {
    const proj = await db.query<{ id: number }>(
      `insert into public.projects (name, client_id) values ('Client Reno 2', $1) returning id`,
      [CLIENT.id]
    );
    const projectId = proj.rows[0].id;
    const est = await db.query<{ id: number }>(
      `insert into public.project_estimates (project_id, status, contingency_percent, markup_enabled, markup_percent, management_fee_enabled, management_fee_percent)
       values ($1, 'draft', '10', true, '25', true, '15') returning id`,
      [projectId]
    );
    const estimateId = est.rows[0].id;
    await db.query(
      `insert into public.estimate_items (estimate_id, room, unit_type, quantity, unit_cost, material_cost) values
        ($1, 'Kitchen', 'sq_ft', '10', '20', '5'),
        ($1, 'Bathroom', 'hour', '2', '100', '0')`,
      [estimateId]
    );
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.approve_estimate($1)`, [estimateId]);
    }, { commit: true });

    // Hand-calculated: subtotal = 250 + 200 = 450; contingency 10% = 45 -> 495;
    // markup 25% of 495 = 123.75 -> 618.75; mgmt fee 15% of 618.75 = 92.8125 -> 711.5625
    await asUser(db, CLIENT, async () => {
      const result = await db.query<{ get_client_estimate_summary: { total: string } }>(
        `select public.get_client_estimate_summary($1)`,
        [projectId]
      );
      expect(Number(result.rows[0].get_client_estimate_summary.total)).toBeCloseTo(711.5625, 6);
    });
  });

  it("returns null when the estimate is still a draft", async () => {
    const proj = await db.query<{ id: number }>(
      `insert into public.projects (name, client_id) values ('Draft Only', $1) returning id`,
      [CLIENT.id]
    );
    const projectId = proj.rows[0].id;
    await db.query(`insert into public.project_estimates (project_id, status) values ($1, 'draft')`, [projectId]);

    await asUser(db, CLIENT, async () => {
      const result = await db.query<{ get_client_estimate_summary: unknown }>(
        `select public.get_client_estimate_summary($1)`,
        [projectId]
      );
      expect(result.rows[0].get_client_estimate_summary).toBeNull();
    });
  });

  it("rejects a client who isn't on the project", async () => {
    const { projectId } = await seedClientProjectWithApprovedEstimate();
    await asUser(db, OTHER_CLIENT, async () => {
      await expect(
        db.query(`select public.get_client_estimate_summary($1)`, [projectId])
      ).rejects.toThrow(/not authorized/i);
    });
  });

  it("lets an admin call it for any project", async () => {
    const { projectId } = await seedClientProjectWithApprovedEstimate();
    await asUser(db, ADMIN, async () => {
      const result = await db.query<{ get_client_estimate_summary: { total: string } }>(
        `select public.get_client_estimate_summary($1)`,
        [projectId]
      );
      expect(result.rows[0].get_client_estimate_summary).not.toBeNull();
    });
  });

  it("includes no document fields (both null) when nothing is attached", async () => {
    const { projectId } = await seedClientProjectWithApprovedEstimate();
    await asUser(db, CLIENT, async () => {
      const result = await db.query<{ get_client_estimate_summary: { document_title: string | null; document_url: string | null } }>(
        `select public.get_client_estimate_summary($1)`,
        [projectId]
      );
      const summary = result.rows[0].get_client_estimate_summary;
      expect(summary.document_title).toBeNull();
      expect(summary.document_url).toBeNull();
    });
  });
});

describe("attach_estimate_document", () => {
  let db: PGlite;

  const ADMIN: TestUser = { id: "11111111-1111-1111-1111-111111111111", email: "admin@test.local", role: "admin" };
  const CREW: TestUser = { id: "22222222-2222-2222-2222-222222222222", email: "crew@test.local", role: "crew" };
  const CLIENT: TestUser = { id: "33333333-3333-3333-3333-333333333333", email: "client@test.local", role: "client" };

  beforeAll(async () => {
    db = await createTestDb();
    await seedUser(db, ADMIN);
    await seedUser(db, CREW);
    await seedUser(db, CLIENT);
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  async function seedApprovedEstimateForClient() {
    const proj = await db.query<{ id: number }>(
      `insert into public.projects (name, client_id) values ('Doc Test', $1) returning id`,
      [CLIENT.id]
    );
    const projectId = proj.rows[0].id;
    const est = await db.query<{ id: number }>(
      `insert into public.project_estimates (project_id, status, markup_enabled, contingency_percent) values ($1, 'draft', false, '0') returning id`,
      [projectId]
    );
    const estimateId = est.rows[0].id;
    await asUser(db, ADMIN, async () => {
      await db.query(`select public.approve_estimate($1)`, [estimateId]);
    }, { commit: true });
    return { projectId, estimateId };
  }

  it("attaches a document to a locked estimate, bypassing the draft-only update lock", async () => {
    const { projectId, estimateId } = await seedApprovedEstimateForClient();
    await asUser(db, ADMIN, async () => {
      const result = await db.query<{ attach_estimate_document: number }>(
        `select public.attach_estimate_document($1, $2, $3, $4)`,
        [estimateId, "Signed Proposal", "https://example.supabase.co/storage/v1/object/public/project-assets/uploads/proposal.pdf", "pdf"]
      );
      expect(result.rows[0].attach_estimate_document).toBeGreaterThan(0);

      const estimate = await db.query<{ document_id: number }>(
        `select document_id from public.project_estimates where id = $1`,
        [estimateId]
      );
      expect(estimate.rows[0].document_id).toBe(result.rows[0].attach_estimate_document);

      const summary = await db.query<{ get_client_estimate_summary: { document_title: string; document_url: string } }>(
        `select public.get_client_estimate_summary($1)`,
        [projectId]
      );
      expect(summary.rows[0].get_client_estimate_summary.document_title).toBe("Signed Proposal");
      expect(summary.rows[0].get_client_estimate_summary.document_url).toContain("proposal.pdf");
    });
  });

  it("rejects a non-admin", async () => {
    const { estimateId } = await seedApprovedEstimateForClient();
    await asUser(db, CREW, async () => {
      await expect(
        db.query(`select public.attach_estimate_document($1, $2, $3, $4)`, [estimateId, "x", "https://x", "pdf"])
      ).rejects.toThrow(/only admins/i);
    });
  });
});
