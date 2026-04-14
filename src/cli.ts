#!/usr/bin/env node

import { Command } from "commander";
import { createMemory, readMemory, deleteMemory, updateMemory } from "./memory.js";
import { search, listMemories, rebuildIndex, invalidateCache } from "./indexer.js";
import * as vault from "./vault.js";
import { startMcpServer } from "./mcp-server.js";
import type { MemoryType } from "./types.js";
import { MEMORY_TYPES } from "./types.js";

const program = new Command();

program
  .name("elefante")
  .description("The open, Git-native memory protocol for MCP agents")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize vault (clone repo to ~/.elefante/vault/)")
  .argument("<repo-url>", "Git repository URL")
  .action(async (repoUrl: string) => {
    try {
      await vault.init(repoUrl);
      console.log(`Vault initialized at ~/.elefante/vault/`);
      console.log(`Repository: ${repoUrl}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show vault status")
  .action(async () => {
    const status = await vault.getStatus();
    if (!status.initialized) {
      console.log("Vault not initialized. Run `elefante init <repo-url>`.");
      return;
    }
    console.log(`Vault:     ~/.elefante/vault/`);
    console.log(`Status:    ${status.clean ? "clean" : "dirty"}`);
    console.log(`Commit:    ${status.commit?.substring(0, 8) ?? "none"}`);
    console.log(`Memories:  ${status.memoriesCount}`);
  });

program
  .command("list")
  .description("List memories")
  .option("-t, --type <type>", "Filter by type (user, feedback, project, reference)")
  .option("-p, --profile <profile>", "Filter by profile")
  .option("-s, --sort <sort>", "Sort by (updated, importance, created)", "updated")
  .option("-l, --limit <n>", "Max results", "20")
  .action(async (opts) => {
    ensureInit();
    const metas = listMemories(
      {
        type: validateType(opts.type),
        profile: opts.profile,
        sort: opts.sort,
      },
      parseLimit(opts.limit, 20)
    );

    if (metas.length === 0) {
      console.log("No memories found.");
      return;
    }

    for (const m of metas) {
      const desc = m.description ? ` — ${m.description}` : "";
      console.log(`  [${m.type.padEnd(9)}] ${m.name} (${m.id})${desc}`);
    }
    console.log(`\n${metas.length} memories`);
  });

program
  .command("search")
  .description("Search memories")
  .argument("<query>", "Search query")
  .option("-t, --type <type>", "Filter by type")
  .option("-p, --profile <profile>", "Filter by profile")
  .option("-l, --limit <n>", "Max results", "10")
  .action(async (query: string, opts) => {
    ensureInit();
    const results = await search(
      query,
      { type: validateType(opts.type), profile: opts.profile },
      parseLimit(opts.limit, 20)
    );

    if (results.length === 0) {
      console.log("No memories found.");
      return;
    }

    for (const r of results) {
      const body = r.memory.body.substring(0, 100).replace(/\n/g, " ");
      console.log(`  [${r.memory.type.padEnd(9)}] ${r.memory.name} (${r.memory.id})`);
      console.log(`             ${body}${r.memory.body.length > 100 ? "..." : ""}`);
      console.log();
    }
    console.log(`${results.length} results`);
  });

program
  .command("read")
  .description("Read a specific memory")
  .argument("<id>", "Memory ID")
  .action(async (id: string) => {
    ensureInit();
    const memory = readMemory(id);
    if (!memory) {
      console.error(`Memory ${id} not found`);
      process.exit(1);
    }

    console.log(`# ${memory.name}`);
    console.log(`Type: ${memory.type} | ID: ${memory.id}`);
    if (memory.description) console.log(`Description: ${memory.description}`);
    if (memory.profile) console.log(`Profile: ${memory.profile}`);
    if (memory.tags.length > 0) console.log(`Tags: ${memory.tags.join(", ")}`);
    console.log(`Importance: ${memory.importance} | Updated: ${memory.updated_at}`);
    console.log(`---`);
    console.log(memory.body);
  });

program
  .command("add")
  .description("Create a new memory")
  .requiredOption("-n, --name <name>", "Memory title")
  .requiredOption("-t, --type <type>", "Memory type (user, feedback, project, reference)")
  .requiredOption("-b, --body <body>", "Memory content")
  .option("-d, --description <desc>", "One-line description")
  .option("-p, --profile <profile>", "Profile scope")
  .option("--tags <tags>", "Comma-separated tags")
  .action(async (opts) => {
    ensureInit();
    const type = validateType(opts.type);
    if (!type) {
      console.error(`Invalid type: ${opts.type}. Must be one of: ${MEMORY_TYPES.join(", ")}`);
      process.exit(1);
    }
    const memory = await createMemory({
      name: opts.name,
      type,
      body: opts.body,
      description: opts.description,
      profile: opts.profile,
      tags: opts.tags?.split(",").map((t: string) => t.trim()),
    });
    console.log(`Created memory ${memory.id}: "${memory.name}" (${memory.type})`);
  });

program
  .command("delete")
  .description("Delete a memory")
  .argument("<id>", "Memory ID")
  .action(async (id: string) => {
    ensureInit();
    const deleted = await deleteMemory(id);
    if (!deleted) {
      console.error(`Memory ${id} not found`);
      process.exit(1);
    }
    console.log(`Deleted memory ${id}`);
  });

program
  .command("sync")
  .description("Pull remote changes, push local changes")
  .action(async () => {
    ensureInit();
    const result = await vault.pull();
    if (result.status !== "ok") {
      console.error(`Sync failed: ${result.message}`);
      process.exit(1);
    }
    invalidateCache();
    try {
      await vault.push();
      console.log("Synced.");
    } catch {
      console.log("Pulled latest. Nothing to push.");
    }
  });

program
  .command("reindex")
  .description("Rebuild index files")
  .action(async () => {
    ensureInit();
    invalidateCache();
    await rebuildIndex();
    console.log("Index rebuilt.");
  });

program
  .command("mcp")
  .description("Start MCP stdio server")
  .action(async () => {
    await startMcpServer();
  });

function ensureInit(): void {
  if (!vault.isInitialized()) {
    console.error("Vault not initialized. Run `elefante init <repo-url>` first.");
    process.exit(1);
  }
}

function validateType(type?: string): MemoryType | undefined {
  if (!type) return undefined;
  if (MEMORY_TYPES.includes(type as MemoryType)) return type as MemoryType;
  console.error(`Invalid type: ${type}. Must be one of: ${MEMORY_TYPES.join(", ")}`);
  process.exit(1);
}

function parseLimit(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) return fallback;
  return n;
}

program.parse();
