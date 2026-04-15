import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { normalizeRemote, isValidProfile, detectProfile } from "../../src/profile.js";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("normalizeRemote", () => {
  it("SSH: git@github.com:owner/repo.git -> owner/repo", () => {
    expect(normalizeRemote("git@github.com:owner/repo.git")).toBe("owner/repo");
  });

  it("SSH no .git: git@github.com:owner/repo -> owner/repo", () => {
    expect(normalizeRemote("git@github.com:owner/repo")).toBe("owner/repo");
  });

  it("HTTPS: https://github.com/owner/repo.git -> owner/repo", () => {
    expect(normalizeRemote("https://github.com/owner/repo.git")).toBe("owner/repo");
  });

  it("HTTPS no .git: https://github.com/owner/repo -> owner/repo", () => {
    expect(normalizeRemote("https://github.com/owner/repo")).toBe("owner/repo");
  });

  it("SSH protocol: ssh://git@github.com/owner/repo.git -> owner/repo", () => {
    expect(normalizeRemote("ssh://git@github.com/owner/repo.git")).toBe("owner/repo");
  });

  it("GitLab nested groups: https://gitlab.com/group/subgroup/repo.git -> group/subgroup/repo", () => {
    expect(normalizeRemote("https://gitlab.com/group/subgroup/repo.git")).toBe(
      "group/subgroup/repo"
    );
  });

  it("handles trailing whitespace and newlines", () => {
    expect(normalizeRemote("git@github.com:owner/repo.git\n")).toBe("owner/repo");
    expect(normalizeRemote("  https://github.com/owner/repo.git  ")).toBe("owner/repo");
    expect(normalizeRemote("git@github.com:owner/repo.git\r\n")).toBe("owner/repo");
  });
});

describe("isValidProfile", () => {
  it("owner/repo -> true", () => {
    expect(isValidProfile("owner/repo")).toBe(true);
  });

  it("owner/sub/repo -> true", () => {
    expect(isValidProfile("owner/sub/repo")).toBe(true);
  });

  it("my-org/my-repo -> true", () => {
    expect(isValidProfile("my-org/my-repo")).toBe(true);
  });

  it("my.org/my.repo -> true", () => {
    expect(isValidProfile("my.org/my.repo")).toBe(true);
  });

  it("../traversal -> false (starts with dot)", () => {
    expect(isValidProfile("../traversal")).toBe(false);
  });

  it(".hidden/repo -> false", () => {
    expect(isValidProfile(".hidden/repo")).toBe(false);
  });

  it("single -> false (no slash)", () => {
    expect(isValidProfile("single")).toBe(false);
  });

  it("empty string -> false", () => {
    expect(isValidProfile("")).toBe(false);
  });

  it("owner/ -> false (trailing slash, no segment after)", () => {
    expect(isValidProfile("owner/")).toBe(false);
  });
});

describe("detectProfile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "elefante-profile-test-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: "pipe" });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns owner/repo when remote origin is set", async () => {
    execSync("git remote add origin git@github.com:testowner/testrepo.git", {
      cwd: tmpDir,
      stdio: "pipe",
    });
    const profile = await detectProfile(tmpDir);
    expect(profile).toBe("testowner/testrepo");
  });

  it("returns null when no remote is configured", async () => {
    const profile = await detectProfile(tmpDir);
    expect(profile).toBeNull();
  });

  it("returns null for a non-git directory", async () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), "elefante-no-git-"));
    const profile = await detectProfile(nonGitDir);
    expect(profile).toBeNull();
    rmSync(nonGitDir, { recursive: true, force: true });
  });
});
