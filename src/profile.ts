import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Detect the current project profile from the working directory.
 * Uses the git remote origin URL, normalized to "owner/repo".
 * Returns null if not in a git repo or no remote is configured.
 */
export async function detectProfile(cwd?: string): Promise<string | null> {
  const dir = cwd ?? process.cwd();

  try {
    const { stdout } = await exec("git", ["remote", "get-url", "origin"], {
      cwd: dir,
      timeout: 5000,
    });
    const profile = normalizeRemote(stdout.trim());
    return isValidProfile(profile) ? profile : null;
  } catch {
    return null;
  }
}

/**
 * Validate that a profile string is safe (no path traversal, no special chars).
 * Allows owner/repo and owner/group/repo patterns.
 */
export function isValidProfile(profile: string): boolean {
  // Each segment must start with a word char (no leading dots for traversal)
  return /^[\w][\w.\-]*(?:\/[\w][\w.\-]*)+$/.test(profile);
}

/**
 * Normalize a git remote URL to "owner/repo" format.
 *
 * Handles:
 *   git@github.com:owner/repo.git     → owner/repo
 *   https://github.com/owner/repo.git → owner/repo
 *   https://github.com/owner/repo     → owner/repo
 *   ssh://git@github.com/owner/repo   → owner/repo
 */
export function normalizeRemote(url: string): string {
  let cleaned = url.trim();

  // SSH format: git@host:owner/repo.git
  const sshMatch = cleaned.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  // HTTPS or SSH protocol: https://host/owner/repo.git
  try {
    const parsed = new URL(cleaned);
    const path = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "");
    return path;
  } catch {
    // Not a valid URL — return as-is, stripped of .git
    return cleaned.replace(/\.git$/, "");
  }
}
