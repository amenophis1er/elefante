import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createTempVault } from "../helpers/vault-harness.js";

const { mockVaultDir } = vi.hoisted(() => {
  return { mockVaultDir: { value: "" } };
});

vi.mock("../../src/auth.js", () => ({
  get VAULT_DIR() { return mockVaultDir.value; },
  resolveAuth: vi.fn(),
}));

import { rebuildIndex, search, listMemories, invalidateCache } from "../../src/indexer.js";
import { createMemory } from "../../src/memory.js";

let cleanup: () => void;

beforeEach(async () => {
  const vault = await createTempVault();
  mockVaultDir.value = vault.dir;
  cleanup = vault.cleanup;

  // Create 3 memories with distinct content
  await createMemory({
    name: "TypeScript preferences",
    type: "user",
    body: "Always use strict mode and ESM modules",
    tags: ["typescript", "config"],
  });

  await createMemory({
    name: "Database testing",
    type: "feedback",
    body: "Never mock the database in integration tests",
    tags: ["testing", "database"],
  });

  await createMemory({
    name: "Auth rewrite",
    type: "project",
    body: "Rewriting authentication middleware for legal compliance",
    tags: ["auth"],
    profile: "owner/repo",
  });

  invalidateCache();
});

afterEach(() => {
  cleanup?.();
});

describe("rebuildIndex", () => {
  it("creates index/manifest.json and index/search.json files", async () => {
    await rebuildIndex();
    expect(existsSync(join(mockVaultDir.value, "index/manifest.json"))).toBe(true);
    expect(existsSync(join(mockVaultDir.value, "index/search.json"))).toBe(true);
  });
});

describe("search", () => {
  it("finds TypeScript preferences by keyword 'typescript'", async () => {
    const results = await search("typescript");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.memory.name === "TypeScript preferences")).toBe(true);
  });

  it("finds Database testing by keyword 'database'", async () => {
    const results = await search("database");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.memory.name === "Database testing")).toBe(true);
  });

  it("finds Auth rewrite by keyword 'authentication'", async () => {
    const results = await search("authentication");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.memory.name === "Auth rewrite")).toBe(true);
  });

  it("filters by type", async () => {
    const results = await search("testing", { type: "feedback" });
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.memory.type).toBe("feedback");
    }
    expect(results.some((r) => r.memory.name === "Database testing")).toBe(true);
  });

  it("filters by profile: includes matching profile and global memories", async () => {
    const results = await search("auth", { profile: "owner/repo" });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.memory.name === "Auth rewrite")).toBe(true);
    // Global memories (profile: null) may also appear if they match
    for (const r of results) {
      expect(
        r.memory.profile === null || r.memory.profile === "owner/repo"
      ).toBe(true);
    }
  });

  it("filters by profile '__global__': only returns memories with null profile", async () => {
    const results = await search("strict mode", { profile: "__global__" });
    for (const r of results) {
      expect(r.memory.profile).toBeNull();
    }
  });

  it("returns empty array for non-matching query", async () => {
    const results = await search("zzzzqqqwww");
    expect(results).toEqual([]);
  });

  it("respects limit parameter", async () => {
    // Create extra memories so there are more than 1 possible result
    await createMemory({
      name: "Extra code style",
      type: "user",
      body: "Always use strict linting rules and strict formatting",
      tags: ["style"],
    });
    invalidateCache();

    const results = await search("strict", undefined, 1);
    expect(results.length).toBe(1);
  });
});

describe("listMemories", () => {
  it("returns all memories as MemoryMeta (has path, no body)", () => {
    const metas = listMemories();
    expect(metas.length).toBe(3);
    for (const meta of metas) {
      expect(meta).toHaveProperty("path");
      expect(meta).toHaveProperty("id");
      expect(meta).toHaveProperty("name");
      expect(meta).not.toHaveProperty("body");
    }
  });

  it("filters by type", () => {
    const metas = listMemories({ type: "feedback" });
    expect(metas.length).toBe(1);
    expect(metas[0].type).toBe("feedback");
    expect(metas[0].name).toBe("Database testing");
  });

  it("sorts by importance descending", () => {
    const metas = listMemories({ sort: "importance" });
    for (let i = 1; i < metas.length; i++) {
      expect(metas[i - 1].importance).toBeGreaterThanOrEqual(metas[i].importance);
    }
  });

  it("sorts by created descending (newer first)", () => {
    const metas = listMemories({ sort: "created" });
    for (let i = 1; i < metas.length; i++) {
      expect(metas[i - 1].created_at >= metas[i].created_at).toBe(true);
    }
  });

  it("supports pagination with offset and limit", () => {
    const all = listMemories(undefined, 20, 0);
    const page = listMemories(undefined, 1, 1);
    expect(page.length).toBe(1);
    // The single result should match the second item from the full list
    expect(page[0].id).toBe(all[1].id);
  });
});

describe("invalidateCache", () => {
  it("forces reload so newly created memories appear", async () => {
    const beforeCount = listMemories().length;

    await createMemory({
      name: "Post-invalidate memory",
      type: "user",
      body: "This memory was created after initial setup",
      tags: ["test"],
    });

    invalidateCache();

    const afterCount = listMemories().length;
    expect(afterCount).toBe(beforeCount + 1);
  });
});
