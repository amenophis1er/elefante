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
  writeVaultFile,
  readVaultFile,
  deleteVaultFile,
  vaultFileExists,
  isInitialized,
  getConfig,
  commit,
  pull,
  getHeadCommit,
  getStatus,
} from "../../src/vault.js";

import { execSync } from "node:child_process";

describe("vault", () => {
  let cleanup: () => void;

  beforeEach(async () => {
    const vault = await createTempVault();
    mockVaultDir.value = vault.dir;
    cleanup = vault.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("writeVaultFile + readVaultFile round-trip", () => {
    const content = "hello world\nline two";
    writeVaultFile("test.txt", content);
    expect(readVaultFile("test.txt")).toBe(content);
  });

  it("writeVaultFile creates intermediate directories", () => {
    writeVaultFile("a/b/c/deep.txt", "nested");
    expect(readVaultFile("a/b/c/deep.txt")).toBe("nested");
  });

  it("deleteVaultFile removes the file", () => {
    writeVaultFile("to-delete.txt", "bye");
    expect(vaultFileExists("to-delete.txt")).toBe(true);
    deleteVaultFile("to-delete.txt");
    expect(vaultFileExists("to-delete.txt")).toBe(false);
  });

  it("deleteVaultFile on non-existent file is a no-op", () => {
    expect(() => deleteVaultFile("does-not-exist.txt")).not.toThrow();
  });

  it("vaultFileExists returns true for existing file, false for non-existent", () => {
    writeVaultFile("exists.txt", "yes");
    expect(vaultFileExists("exists.txt")).toBe(true);
    expect(vaultFileExists("nope.txt")).toBe(false);
  });

  it("readVaultFile throws on path traversal", () => {
    expect(() => readVaultFile("../../../etc/passwd")).toThrow("traversal");
  });

  it("writeVaultFile throws on path traversal", () => {
    expect(() => writeVaultFile("../outside", "data")).toThrow("traversal");
  });

  it("isInitialized returns true for temp vault with .git", () => {
    expect(isInitialized()).toBe(true);
  });

  it("getConfig returns config with correct defaults merged", () => {
    const config = getConfig();
    expect(config.version).toBe("0.1");
    expect(config.index.auto_rebuild).toBe(true);
    expect(config.memory.max_body_length).toBe(10000);
    expect(config.sync.commit_strategy).toBe("immediate");
    expect(config.sync.batch_window_ms).toBe(5000);
    expect(config.sync.push_strategy).toBe("async");
  });

  it("commit creates a git commit", async () => {
    writeVaultFile("committed.txt", "data");
    await commit("test commit message", ["committed.txt"]);

    const log = execSync("git log --oneline -1", {
      cwd: mockVaultDir.value,
      encoding: "utf-8",
    });
    expect(log).toContain("test commit message");
  });

  it("getHeadCommit returns a commit hash", async () => {
    const hash = await getHeadCommit();
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("pull returns error when no remote configured", async () => {
    const result = await pull();
    // No remote, so pull fails with an error (not a conflict)
    expect(result.status).toBe("error");
    expect(result.message).toBeTruthy();
  });

  it("getStatus returns initialized status with correct shape", async () => {
    const status = await getStatus();
    expect(status.initialized).toBe(true);
    expect(status.clean).toBe(true);
    expect(status.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(status.memoriesCount).toBe(0);
  });

  it("getStatus detects dirty vault", async () => {
    // Modify an already-tracked file so git diff detects it
    writeVaultFile(".elefante/config.yaml", "modified: true\n");
    const status = await getStatus();
    expect(status.initialized).toBe(true);
    expect(status.clean).toBe(false);
  });

  it("getStatus counts memory files", async () => {
    writeVaultFile("memories/user/mem_test1234.md", "test");
    writeVaultFile("memories/feedback/mem_test5678.md", "test");
    const status = await getStatus();
    expect(status.memoriesCount).toBe(2);
  });

  it("getConfig merges partial config with defaults", () => {
    // Write a partial config that only overrides one field
    writeVaultFile(".elefante/config.yaml", 'version: "0.2"\n');
    const config = getConfig();
    expect(config.version).toBe("0.2");
    // Defaults should still be present
    expect(config.index.auto_rebuild).toBe(true);
    expect(config.memory.max_body_length).toBe(10000);
  });
});
