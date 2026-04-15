import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DEFAULT_CONFIG_YAML = `version: "0.1"
default_profile: null
index:
  auto_rebuild: true
memory:
  max_body_length: 10000
sync:
  commit_strategy: immediate
  batch_window_ms: 5000
  push_strategy: async
  poll_interval_s: 60
`;

/**
 * Creates an isolated temp vault with a git repo, directory structure,
 * and default config. Returns the path and a cleanup function.
 *
 * Usage in test files:
 *
 * ```typescript
 * import { vi } from "vitest";
 *
 * // This must be at the top of each test file that needs vault isolation
 * const { mockVaultDir } = vi.hoisted(() => {
 *   return { mockVaultDir: { value: "" } };
 * });
 *
 * vi.mock("../../src/auth.js", () => ({
 *   get VAULT_DIR() { return mockVaultDir.value; },
 *   resolveAuth: vi.fn(),
 * }));
 * ```
 *
 * Then in beforeEach:
 * ```typescript
 * const vault = await createTempVault();
 * mockVaultDir.value = vault.dir;
 * // in afterEach: vault.cleanup();
 * ```
 */
export async function createTempVault(): Promise<{ dir: string; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), "elefante-test-"));

  // Init git repo
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: dir, stdio: "pipe" });

  // Create vault directory structure
  const dirs = [
    "memories/user",
    "memories/feedback",
    "memories/project",
    "memories/reference",
    "profiles",
    "index",
    ".elefante",
  ];

  for (const d of dirs) {
    const fullPath = join(dir, d);
    mkdirSync(fullPath, { recursive: true });
    writeFileSync(join(fullPath, ".gitkeep"), "");
  }

  // Write default config
  writeFileSync(join(dir, ".elefante", "config.yaml"), DEFAULT_CONFIG_YAML);

  // Initial commit
  execSync("git add .", { cwd: dir, stdio: "pipe" });
  execSync('git commit -m "init test vault"', { cwd: dir, stdio: "pipe" });

  return {
    dir,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
