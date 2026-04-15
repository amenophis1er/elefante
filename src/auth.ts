import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AuthMethod } from "./types.js";

const exec = promisify(execFile);

export const VAULT_DIR = process.env.ELEFANTE_VAULT_DIR ?? join(homedir(), ".elefante", "vault");
const CONFIG_PATH = join(homedir(), ".elefante", "config.json");

export async function resolveAuth(): Promise<AuthMethod> {
  // 1. Local clone exists? Use native git
  if (existsSync(join(VAULT_DIR, ".git"))) {
    return { type: "local-git", path: VAULT_DIR };
  }

  // 2. gh CLI installed? Borrow its token
  try {
    const { stdout } = await exec("gh", ["auth", "token"]);
    const token = stdout.trim();
    if (token) {
      return { type: "github-api", token };
    }
  } catch {
    // gh not installed or not authenticated
  }

  // 3. Env var
  const envToken = process.env.ELEFANTE_GITHUB_TOKEN;
  if (envToken) {
    return { type: "github-api", token: envToken };
  }

  // 4. Config file
  if (existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      if (config.token) {
        return { type: "github-api", token: config.token };
      }
    } catch {
      // malformed config
    }
  }

  throw new Error(
    "No authentication found. Run `elefante init <repo-url>` or `gh auth login`."
  );
}
