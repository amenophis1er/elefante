import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import matter from "gray-matter";
import { createMemory, listAllMemories } from "./memory.js";
import { normalizeRemote } from "./profile.js";
import type { MemoryType } from "./types.js";
import { MEMORY_TYPES } from "./types.js";

const exec = promisify(execFile);

interface ClaudeMemory {
  name: string;
  type: MemoryType;
  description: string | null;
  body: string;
  profile: string | null;
  sourcePath: string;
  projectDir: string | null;
}

function claudeProjectsDir(): string {
  return join(homedir(), ".claude", "projects");
}

function reconstructPath(claudeName: string): string {
  // Claude encodes paths as: -Users-amen-Projects-Perso-x-phone-xpbx
  // Naive dash-to-slash fails for paths containing dashes (x-phone → x/phone).
  // Instead, walk the filesystem progressively to resolve ambiguity.
  const segments = claudeName.replace(/^-/, "").split("-");
  let resolved = "/";

  let i = 0;
  while (i < segments.length) {
    // Try increasingly longer dash-joined segments to find a real directory
    let found = false;
    for (let j = segments.length; j > i; j--) {
      const candidate = segments.slice(i, j).join("-");
      const testPath = join(resolved, candidate);
      if (existsSync(testPath)) {
        resolved = testPath;
        i = j;
        found = true;
        break;
      }
    }
    if (!found) {
      // Fallback: take the single segment
      resolved = join(resolved, segments[i]);
      i++;
    }
  }

  return resolved;
}

async function getGitRemote(dir: string): Promise<string | null> {
  if (!existsSync(join(dir, ".git"))) return null;
  try {
    const { stdout } = await exec("git", ["remote", "get-url", "origin"], {
      cwd: dir,
      timeout: 5000,
    });
    return normalizeRemote(stdout.trim());
  } catch {
    return null;
  }
}

export async function discoverClaudeMemories(): Promise<ClaudeMemory[]> {
  const projectsDir = claudeProjectsDir();
  if (!existsSync(projectsDir)) return [];

  const memories: ClaudeMemory[] = [];
  const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const projectEntry of projectDirs) {
    const memoryDir = join(projectsDir, projectEntry.name, "memory");
    if (!existsSync(memoryDir)) continue;

    const realPath = reconstructPath(projectEntry.name);
    const profile = await getGitRemote(realPath);

    const files = readdirSync(memoryDir)
      .filter((f) => f.endsWith(".md") && f !== "MEMORY.md");

    for (const file of files) {
      const filePath = join(memoryDir, file);
      try {
        const raw = readFileSync(filePath, "utf-8");
        const { data, content } = matter(raw);

        const type = MEMORY_TYPES.includes(data.type as MemoryType)
          ? (data.type as MemoryType)
          : "user";

        memories.push({
          name: data.name || basename(file, ".md"),
          type,
          description: data.description || null,
          body: content.trim(),
          profile,
          sourcePath: filePath,
          projectDir: realPath,
        });
      } catch {
        // skip malformed files
      }
    }
  }

  return memories;
}

export async function importClaudeMemories(
  options: { dryRun?: boolean } = {}
): Promise<{ imported: number; skipped: number; errors: number }> {
  const claudeMemories = await discoverClaudeMemories();

  if (claudeMemories.length === 0) {
    console.log("No Claude Code memories found in ~/.claude/projects/");
    return { imported: 0, skipped: 0, errors: 0 };
  }

  // Check for existing memories to avoid duplicates
  const existing = listAllMemories();
  const existingNames = new Set(existing.map((m) => `${m.type}:${m.name}`));

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`Found ${claudeMemories.length} Claude memories across ${new Set(claudeMemories.map((m) => m.projectDir)).size} projects\n`);

  for (const mem of claudeMemories) {
    const key = `${mem.type}:${mem.name}`;
    if (existingNames.has(key)) {
      if (!options.dryRun) {
        console.log(`  skip  [${mem.type}] ${mem.name} (already exists)`);
      }
      skipped++;
      continue;
    }

    const scope = mem.profile ? mem.profile : "global";

    if (options.dryRun) {
      console.log(`  would import  [${mem.type.padEnd(9)}] ${mem.name} → ${scope}`);
      imported++;
      continue;
    }

    try {
      const created = await createMemory({
        name: mem.name,
        type: mem.type,
        body: mem.body,
        description: mem.description ?? undefined,
        profile: mem.profile ?? undefined,
      });
      console.log(`  imported  [${mem.type.padEnd(9)}] ${created.name} (${created.id}) → ${scope}`);
      imported++;
    } catch (err) {
      console.error(`  error  [${mem.type}] ${mem.name}: ${err instanceof Error ? err.message : err}`);
      errors++;
    }
  }

  console.log(`\n${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}
