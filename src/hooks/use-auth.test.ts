import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { buildFallbackUser } from "./use-auth";

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    email: "jane@example.com",
    created_at: "2026-01-01T00:00:00.000Z",
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    ...overrides,
  } as User;
}

describe("buildFallbackUser", () => {
  it("takes role from app_metadata when both metadata sources disagree", () => {
    // This is the exact escalation scenario the security fix addresses:
    // user_metadata is client-writable (any signed-in user can set it via
    // supabase.auth.updateUser), app_metadata is not. If role were read
    // from user_metadata here, a user could self-promote to admin.
    const user = fakeUser({
      user_metadata: { role: "admin", name: "Jane" },
      app_metadata: { role: "crew" },
    });

    const result = buildFallbackUser(user);

    expect(result.role).toBe("crew");
  });

  it("defaults role to 'crew' when app_metadata has no role at all", () => {
    const user = fakeUser({
      user_metadata: { role: "admin" },
      app_metadata: {},
    });

    const result = buildFallbackUser(user);

    expect(result.role).toBe("crew");
  });

  it("still reads display name from user_metadata (non-privileged field)", () => {
    const user = fakeUser({
      user_metadata: { name: "Jane Doe", role: "admin" },
      app_metadata: { role: "crew" },
    });

    const result = buildFallbackUser(user);

    expect(result.name).toBe("Jane Doe");
    expect(result.role).toBe("crew");
  });

  it("falls back to the email's local part when no name is set", () => {
    const user = fakeUser({ email: "jane@example.com", user_metadata: {} });

    const result = buildFallbackUser(user);

    expect(result.name).toBe("jane");
  });
});
