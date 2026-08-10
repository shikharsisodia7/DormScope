// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Clerk before importing admin-auth so the module loads without network calls.
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  currentUser: vi.fn().mockResolvedValue(null),
}));

import { getAdminAllowlist, requireAdminKey } from "@/lib/admin-auth";

const originalEnv = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

beforeEach(() => {
  delete process.env.ADMIN_USER_IDS;
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_API_KEY;
  delete process.env.CLERK_SECRET_KEY;
});

afterEach(() => {
  Object.keys(process.env).forEach((k) => delete process.env[k]);
  Object.assign(process.env, originalEnv);
});

describe("getAdminAllowlist", () => {
  it("returns empty arrays when env vars are not set", () => {
    const { userIds, emails } = getAdminAllowlist();
    expect(userIds).toEqual([]);
    expect(emails).toEqual([]);
  });

  it("parses single user ID", () => {
    setEnv({ ADMIN_USER_IDS: "user_abc123" });
    const { userIds } = getAdminAllowlist();
    expect(userIds).toContain("user_abc123");
  });

  it("parses comma-separated user IDs", () => {
    setEnv({ ADMIN_USER_IDS: "user_a, user_b , user_c" });
    const { userIds } = getAdminAllowlist();
    expect(userIds).toEqual(["user_a", "user_b", "user_c"]);
  });

  it("parses and lowercases comma-separated emails", () => {
    setEnv({ ADMIN_EMAILS: "Admin@Example.COM, other@test.org" });
    const { emails } = getAdminAllowlist();
    expect(emails).toEqual(["admin@example.com", "other@test.org"]);
  });

  it("filters empty segments from comma list", () => {
    setEnv({ ADMIN_USER_IDS: "user_a,,, user_b" });
    const { userIds } = getAdminAllowlist();
    expect(userIds).toEqual(["user_a", "user_b"]);
  });
});

describe("requireAdminKey", () => {
  it("returns false when ADMIN_API_KEY is not set", () => {
    const req = new Request("http://localhost", {
      headers: { "x-admin-key": "secret" },
    });
    expect(requireAdminKey(req)).toBe(false);
  });

  it("returns false when x-admin-key header does not match", () => {
    setEnv({ ADMIN_API_KEY: "correct-secret" });
    const req = new Request("http://localhost", {
      headers: { "x-admin-key": "wrong-secret" },
    });
    expect(requireAdminKey(req)).toBe(false);
  });

  it("returns true when x-admin-key header matches", () => {
    setEnv({ ADMIN_API_KEY: "correct-secret" });
    const req = new Request("http://localhost", {
      headers: { "x-admin-key": "correct-secret" },
    });
    expect(requireAdminKey(req)).toBe(true);
  });

  it("returns true when Authorization Bearer token matches", () => {
    setEnv({ ADMIN_API_KEY: "bearer-secret" });
    const req = new Request("http://localhost", {
      headers: { authorization: "Bearer bearer-secret" },
    });
    expect(requireAdminKey(req)).toBe(true);
  });

  it("returns false when Authorization Bearer token does not match", () => {
    setEnv({ ADMIN_API_KEY: "bearer-secret" });
    const req = new Request("http://localhost", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(requireAdminKey(req)).toBe(false);
  });
});
