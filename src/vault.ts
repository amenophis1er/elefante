import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import type { SyncResult, VaultConfig } from "./types.js";
import { DEFAULT_VAULT_CONFIG } from "./types.js";
import { VAULT_DIR } from "./auth.js";

const exec = promisify(execFile);

function git(args: string[], cwd?: string) {
  return exec("git", args, { cwd: cwd ?? VAULT_DIR });
}

export function isInitialized(): boolean {
  return existsSync(join(VAULT_DIR, ".git"));
}

export async function init(repoUrl: string): Promise<void> {
  if (isInitialized()) {
    throw new Error(`Vault already initialized at ${VAULT_DIR}`);
  }

  mkdirSync(dirname(VAULT_DIR), { recursive: true });
  await exec("git", ["clone", repoUrl, VAULT_DIR]);

  // Ensure vault structure exists
  const dirs = [
    "memories/user",
    "memories/feedback",
    "memories/project",
    "memories/reference",
    "profiles",
    "index",
    ".elefante",
  ];
  for (const dir of dirs) {
    mkdirSync(join(VAULT_DIR, dir), { recursive: true });
  }

  // Write default config if not present
  const configPath = join(VAULT_DIR, ".elefante", "config.yaml");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, YAML.stringify(DEFAULT_VAULT_CONFIG));
  }

  // Write .gitkeep files so empty dirs are tracked
  for (const dir of dirs) {
    const keepFile = join(VAULT_DIR, dir, ".gitkeep");
    if (!existsSync(keepFile)) {
      writeFileSync(keepFile, "");
    }
  }

  await git(["add", "."]);
  await git(["diff", "--cached", "--quiet"]).catch(async () => {
    await git(["commit", "-m", "Initialize elefante vault"]);
    await git(["push"]).catch(() => {
      // Push may fail if remote is empty, that's ok
    });
  });
}

export function getConfig(): VaultConfig {
  const configPath = join(VAULT_DIR, ".elefante", "config.yaml");
  if (!existsSync(configPath)) {
    return DEFAULT_VAULT_CONFIG;
  }
  const raw = readFileSync(configPath, "utf-8");
  const parsed = YAML.parse(raw);
  return { ...DEFAULT_VAULT_CONFIG, ...parsed };
}

export function readVaultFile(relativePath: string): string {
  return readFileSync(join(VAULT_DIR, relativePath), "utf-8");
}

export function writeVaultFile(relativePath: string, content: string): void {
  const fullPath = join(VAULT_DIR, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

export function deleteVaultFile(relativePath: string): void {
  const fullPath = join(VAULT_DIR, relativePath);
  if (existsSync(fullPath)) {
    rmSync(fullPath);
  }
}

export function vaultFileExists(relativePath: string): boolean {
  return existsSync(join(VAULT_DIR, relativePath));
}

export async function commit(message: string, files: string[]): Promise<void> {
  for (const file of files) {
    await git(["add", file]);
  }
  await git(["commit", "-m", message]);
}

export async function push(): Promise<void> {
  await git(["push"]);
}

export function pushAsync(): void {
  // Fire-and-forget push
  git(["push"]).catch(() => {
    // Silently fail — sync will catch up
  });
}

export async function pull(): Promise<SyncResult> {
  try {
    await git(["pull", "--rebase"]);
    return { status: "ok", message: "Pulled latest changes" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("CONFLICT")) {
      return { status: "conflict", message: msg };
    }
    return { status: "error", message: msg };
  }
}

export async function getHeadCommit(): Promise<string | null> {
  try {
    const { stdout } = await git(["rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getStatus(): Promise<{
  initialized: boolean;
  clean: boolean;
  commit: string | null;
  memoriesCount: number;
}> {
  if (!isInitialized()) {
    return { initialized: false, clean: true, commit: null, memoriesCount: 0 };
  }

  const commitHash = await getHeadCommit();

  let clean = true;
  try {
    await git(["diff", "--quiet"]);
    await git(["diff", "--cached", "--quiet"]);
  } catch {
    clean = false;
  }

  let memoriesCount = 0;
  try {
    const { stdout } = await exec("find", [
      join(VAULT_DIR, "memories"),
      "-name",
      "mem_*.md",
      "-type",
      "f",
    ]);
    memoriesCount = stdout.trim().split("\n").filter(Boolean).length;
  } catch {
    // empty
  }

  return { initialized: true, clean, commit: commitHash, memoriesCount };
}
