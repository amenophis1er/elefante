import { readdirSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import matter from "gray-matter";
import type {
  Memory,
  MemoryMeta,
  MemoryType,
  CreateMemoryInput,
  UpdateMemoryInput,
} from "./types.js";
import { MEMORY_TYPES } from "./types.js";
import {
  readVaultFile,
  writeVaultFile,
  deleteVaultFile,
  vaultFileExists,
  commit,
  pushAsync,
  getConfig,
} from "./vault.js";
import { VAULT_DIR } from "./auth.js";
import { rebuildIndex } from "./indexer.js";

function generateId(): string {
  return `mem_${nanoid(12)}`;
}

function memoryPath(type: MemoryType, id: string): string {
  return `memories/${type}/${id}.md`;
}

function now(): string {
  return new Date().toISOString();
}

function serializeMemory(memory: Memory): string {
  const { body, ...frontmatterData } = memory;
  return matter.stringify(body, frontmatterData);
}

function parseMemoryFile(content: string, filePath: string): Memory {
  const { data, content: body } = matter(content);
  return {
    id: data.id,
    type: data.type,
    name: data.name,
    body: body.trim(),
    description: data.description ?? null,
    profile: data.profile ?? null,
    importance: data.importance ?? 0,
    tags: data.tags ?? [],
    created_at: data.created_at,
    updated_at: data.updated_at,
    last_accessed_at: data.last_accessed_at ?? null,
  };
}

export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  const config = getConfig();
  const id = generateId();
  const timestamp = now();

  if (config.memory.max_body_length > 0 && input.body.length > config.memory.max_body_length) {
    throw new Error(`Body exceeds max length of ${config.memory.max_body_length} characters`);
  }

  const memory: Memory = {
    id,
    type: input.type,
    name: input.name,
    body: input.body,
    description: input.description ?? null,
    profile: input.profile ?? null,
    importance: 0,
    tags: input.tags ?? [],
    created_at: timestamp,
    updated_at: timestamp,
    last_accessed_at: null,
  };

  const path = memoryPath(memory.type, id);
  writeVaultFile(path, serializeMemory(memory));

  if (config.index.auto_rebuild) {
    await rebuildIndex();
  }

  await commit(`remember: ${memory.name}`, [path, "index/"]);
  pushAsync();

  return memory;
}

export function readMemory(id: string): Memory | null {
  for (const type of MEMORY_TYPES) {
    const path = memoryPath(type, id);
    if (vaultFileExists(path)) {
      const content = readVaultFile(path);
      return parseMemoryFile(content, path);
    }
  }
  return null;
}

export async function touchMemory(id: string): Promise<void> {
  const memory = readMemory(id);
  if (!memory) return;

  memory.importance += 1;
  memory.last_accessed_at = now();

  const path = memoryPath(memory.type, id);
  writeVaultFile(path, serializeMemory(memory));
}

export async function updateMemory(input: UpdateMemoryInput): Promise<Memory | null> {
  const existing = readMemory(input.id);
  if (!existing) return null;

  const oldType = existing.type;
  const oldPath = memoryPath(oldType, input.id);

  if (input.name !== undefined) existing.name = input.name;
  if (input.type !== undefined) existing.type = input.type;
  if (input.body !== undefined) existing.body = input.body;
  if (input.description !== undefined) existing.description = input.description;
  if (input.tags !== undefined) existing.tags = input.tags;
  existing.updated_at = now();

  const newPath = memoryPath(existing.type, input.id);

  // If type changed, delete old file
  if (oldType !== existing.type) {
    deleteVaultFile(oldPath);
  }

  writeVaultFile(newPath, serializeMemory(existing));

  const config = getConfig();
  if (config.index.auto_rebuild) {
    await rebuildIndex();
  }

  const filesToCommit = oldType !== existing.type
    ? [oldPath, newPath, "index/"]
    : [newPath, "index/"];

  await commit(`update: ${existing.name}`, filesToCommit);
  pushAsync();

  return existing;
}

export async function deleteMemory(id: string): Promise<boolean> {
  const memory = readMemory(id);
  if (!memory) return false;

  const path = memoryPath(memory.type, id);
  deleteVaultFile(path);

  const config = getConfig();
  if (config.index.auto_rebuild) {
    await rebuildIndex();
  }

  await commit(`forget: ${memory.name}`, [path, "index/"]);
  pushAsync();

  return true;
}

export function listAllMemories(): Memory[] {
  const memories: Memory[] = [];

  for (const type of MEMORY_TYPES) {
    const dir = join(VAULT_DIR, "memories", type);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.startsWith("mem_") && f.endsWith(".md"));
    } catch {
      continue;
    }

    for (const file of files) {
      const path = `memories/${type}/${file}`;
      try {
        const content = readVaultFile(path);
        memories.push(parseMemoryFile(content, path));
      } catch {
        // skip malformed files
      }
    }
  }

  return memories;
}

export function memoryToMeta(memory: Memory): MemoryMeta {
  return {
    id: memory.id,
    type: memory.type,
    name: memory.name,
    description: memory.description,
    profile: memory.profile,
    importance: memory.importance,
    tags: memory.tags,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
    last_accessed_at: memory.last_accessed_at,
    path: memoryPath(memory.type, memory.id),
  };
}
