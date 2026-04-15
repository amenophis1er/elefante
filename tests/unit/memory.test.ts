import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTempVault } from "../helpers/vault-harness.js";

const { mockVaultDir } = vi.hoisted(() => {
  return { mockVaultDir: { value: "" } };
});

vi.mock("../../src/auth.js", () => ({
  get VAULT_DIR() { return mockVaultDir.value; },
  resolveAuth: vi.fn(),
}));

import {
  createMemory,
  readMemory,
  updateMemory,
  deleteMemory,
  listAllMemories,
} from "../../src/memory.js";

import { SAMPLE_CREATE_INPUT } from "../helpers/fixtures.js";

function isValidISO(s: string): boolean {
  return !isNaN(Date.parse(s)) && /\d{4}-\d{2}-\d{2}T/.test(s);
}

describe("memory", () => {
  let cleanup: () => void;

  beforeEach(async () => {
    const vault = await createTempVault();
    mockVaultDir.value = vault.dir;
    cleanup = vault.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("createMemory returns a Memory with correct id format, name, type, body", async () => {
    const mem = await createMemory(SAMPLE_CREATE_INPUT);
    expect(mem.id).toMatch(/^mem_[a-zA-Z0-9_-]{12}$/);
    expect(mem.name).toBe(SAMPLE_CREATE_INPUT.name);
    expect(mem.type).toBe(SAMPLE_CREATE_INPUT.type);
    expect(mem.body).toBe(SAMPLE_CREATE_INPUT.body);
  });

  it("createMemory sets created_at and updated_at to valid ISO timestamps", async () => {
    const mem = await createMemory(SAMPLE_CREATE_INPUT);
    expect(isValidISO(mem.created_at)).toBe(true);
    expect(isValidISO(mem.updated_at)).toBe(true);
  });

  it("createMemory with profile sets profile field", async () => {
    const mem = await createMemory({
      ...SAMPLE_CREATE_INPUT,
      profile: "owner/repo",
    });
    expect(mem.profile).toBe("owner/repo");
  });

  it("readMemory returns the created memory with matching fields", async () => {
    const created = await createMemory(SAMPLE_CREATE_INPUT);
    const read = readMemory(created.id);
    expect(read).not.toBeNull();
    expect(read!.id).toBe(created.id);
    expect(read!.name).toBe(created.name);
    expect(read!.type).toBe(created.type);
    expect(read!.body).toBe(created.body);
  });

  it("readMemory returns null for non-existent ID", () => {
    expect(readMemory("mem_doesnotexist")).toBeNull();
  });

  it("updateMemory changes specified fields, updates updated_at, preserves unchanged fields", async () => {
    const created = await createMemory(SAMPLE_CREATE_INPUT);
    const updated = await updateMemory({
      id: created.id,
      body: "Updated body content",
    });
    expect(updated).not.toBeNull();
    expect(updated!.body).toBe("Updated body content");
    expect(updated!.name).toBe(created.name);
    expect(updated!.type).toBe(created.type);
    expect(isValidISO(updated!.updated_at)).toBe(true);
  });

  it("updateMemory type change: user -> feedback, findable as feedback", async () => {
    const created = await createMemory(SAMPLE_CREATE_INPUT);
    expect(created.type).toBe("user");

    const updated = await updateMemory({
      id: created.id,
      type: "feedback",
    });
    expect(updated).not.toBeNull();
    expect(updated!.type).toBe("feedback");

    const read = readMemory(created.id);
    expect(read).not.toBeNull();
    expect(read!.type).toBe("feedback");
  });

  it("updateMemory returns null for non-existent ID", async () => {
    const result = await updateMemory({
      id: "mem_doesnotexist",
      body: "nope",
    });
    expect(result).toBeNull();
  });

  it("deleteMemory returns true, subsequent readMemory returns null", async () => {
    const created = await createMemory(SAMPLE_CREATE_INPUT);
    const deleted = await deleteMemory(created.id);
    expect(deleted).toBe(true);
    expect(readMemory(created.id)).toBeNull();
  });

  it("deleteMemory returns false for non-existent ID", async () => {
    const result = await deleteMemory("mem_doesnotexist");
    expect(result).toBe(false);
  });

  it("listAllMemories returns all created memories", async () => {
    await createMemory({ ...SAMPLE_CREATE_INPUT, name: "Memory 1" });
    await createMemory({ ...SAMPLE_CREATE_INPUT, name: "Memory 2" });
    await createMemory({ ...SAMPLE_CREATE_INPUT, name: "Memory 3" });

    const all = listAllMemories();
    expect(all).toHaveLength(3);
    const names = all.map((m) => m.name);
    expect(names).toContain("Memory 1");
    expect(names).toContain("Memory 2");
    expect(names).toContain("Memory 3");
  });

  it("listAllMemories returns empty array when vault is empty", () => {
    const all = listAllMemories();
    expect(all).toHaveLength(0);
  });

  it("createMemory enforces max body length", async () => {
    const longBody = "x".repeat(10001);
    await expect(
      createMemory({ ...SAMPLE_CREATE_INPUT, body: longBody })
    ).rejects.toThrow("max length");
  });
});
