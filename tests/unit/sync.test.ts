import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTempVault } from "../helpers/vault-harness.js";

const { mockVaultDir, mockExecFile } = vi.hoisted(() => {
  return {
    mockVaultDir: { value: "" },
    mockExecFile: { handler: null as ((...args: any[]) => any) | null },
  };
});

vi.mock("../../src/auth.js", () => ({
  get VAULT_DIR() { return mockVaultDir.value; },
  resolveAuth: vi.fn(),
}));

// Mock child_process to allow intercepting git commands in specific tests.
// We need to preserve the util.promisify.custom behavior of execFile so that
// promisify(execFile) resolves with { stdout, stderr } rather than just stdout.
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const { promisify } = await import("node:util");

  // Build a wrapper that delegates to the handler or real execFile
  const wrappedExecFile: any = (...args: any[]) => {
    if (mockExecFile.handler) {
      return mockExecFile.handler(...args);
    }
    return actual.execFile(...(args as Parameters<typeof actual.execFile>));
  };

  // Attach a custom promisify that mirrors the real execFile behavior:
  // returns a Promise<{ stdout, stderr }> and dispatches through the handler
  wrappedExecFile[promisify.custom] = (cmd: string, args: string[], opts: any) => {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const cb = (err: Error | null, stdout: string, stderr: string) => {
        if (err) return reject(err);
        resolve({ stdout, stderr });
      };
      if (mockExecFile.handler) {
        mockExecFile.handler(cmd, args, opts, cb);
      } else {
        actual.execFile(cmd, args, opts, cb);
      }
    });
  };

  return {
    ...actual,
    execFile: wrappedExecFile,
  };
});

import {
  fetch,
  isBehind,
  isAhead,
  pullBeforeWrite,
  syncOnce,
  getConfig,
} from "../../src/vault.js";

describe("sync functions", () => {
  let cleanup: () => void;

  beforeEach(async () => {
    const v = await createTempVault();
    mockVaultDir.value = v.dir;
    cleanup = v.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("pullBeforeWrite does not throw when no remote", async () => {
    await expect(pullBeforeWrite()).resolves.toBeUndefined();
  });

  it("fetch throws when no remote configured", async () => {
    await expect(fetch()).rejects.toThrow();
  });

  it("isBehind returns false with no remote", async () => {
    expect(await isBehind()).toBe(false);
  });

  it("isAhead returns false with no remote", async () => {
    expect(await isAhead()).toBe(false);
  });

  it("syncOnce returns early when fetch fails (no remote)", async () => {
    const callback = vi.fn();
    await syncOnce(callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it("config has poll_interval_s default", () => {
    const config = getConfig();
    expect(config.sync.poll_interval_s).toBe(60);
  });
});

describe("pullBeforeWrite conflict handling", () => {
  let cleanup: () => void;

  beforeEach(async () => {
    const v = await createTempVault();
    mockVaultDir.value = v.dir;
    cleanup = v.cleanup;
  });

  afterEach(() => {
    cleanup();
    mockExecFile.handler = null;
  });

  it("throws on conflict", async () => {
    const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    mockExecFile.handler = (cmd: string, args: string[], opts: any, cb?: any) => {
      const callback = typeof opts === "function" ? opts : cb;
      if (args?.[0] === "pull") {
        const err = new Error("git pull failed") as any;
        err.stderr = "CONFLICT in memories/user/mem_test.md";
        callback(err, "", "CONFLICT in memories/user/mem_test.md");
        return;
      }
      return actual.execFile(cmd, args, opts, cb);
    };

    await expect(pullBeforeWrite()).rejects.toThrow("conflict");
  });
});

describe("syncOnce with mocked git", () => {
  let cleanup: () => void;

  beforeEach(async () => {
    const v = await createTempVault();
    mockVaultDir.value = v.dir;
    cleanup = v.cleanup;
  });

  afterEach(() => {
    cleanup();
    mockExecFile.handler = null;
  });

  it("calls onPulled when pull succeeds", async () => {
    const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    mockExecFile.handler = (cmd: string, args: string[], opts: any, cb?: any) => {
      const callback = typeof opts === "function" ? opts : cb;
      if (args?.[0] === "fetch") {
        callback(null, "", "");
        return;
      }
      if (args?.includes("rev-list") && args?.includes("HEAD..@{u}")) {
        callback(null, "1\n", "");
        return;
      }
      if (args?.[0] === "pull") {
        callback(null, "Already up to date.\n", "");
        return;
      }
      if (args?.includes("rev-list") && args?.includes("@{u}..HEAD")) {
        callback(null, "0\n", "");
        return;
      }
      return actual.execFile(cmd, args, opts, cb);
    };

    const callback = vi.fn();
    await syncOnce(callback);

    expect(callback).toHaveBeenCalledOnce();
  });
});
