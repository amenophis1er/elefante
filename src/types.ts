import { z } from "zod";

export const MEMORY_TYPES = ["user", "feedback", "project", "reference"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface Memory {
  id: string;
  type: MemoryType;
  name: string;
  body: string;
  description: string | null;
  profile: string | null;
  importance: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

export interface MemoryMeta {
  id: string;
  type: MemoryType;
  name: string;
  description: string | null;
  profile: string | null;
  importance: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  path: string;
}

export interface VaultConfig {
  version: string;
  default_profile: string | null;
  index: {
    auto_rebuild: boolean;
  };
  memory: {
    max_body_length: number;
  };
  sync: {
    commit_strategy: "immediate" | "batched";
    batch_window_ms: number;
    push_strategy: "async" | "on-idle";
    poll_interval_s: number;
  };
}

export const DEFAULT_VAULT_CONFIG: VaultConfig = {
  version: "0.1",
  default_profile: null,
  index: {
    auto_rebuild: true,
  },
  memory: {
    max_body_length: 10000,
  },
  sync: {
    commit_strategy: "immediate",
    batch_window_ms: 5000,
    push_strategy: "async",
    poll_interval_s: 60,
  },
};

export interface Manifest {
  generated_at: string;
  version: string;
  commit: string | null;
  count: number;
  memories: MemoryMeta[];
}

export interface SearchIndex {
  generated_at: string;
  version: string;
  trigrams: Record<string, string[]>;
  keywords: Record<string, string[]>;
}

export interface SearchResult {
  memory: Memory;
  score: number;
}

export interface SyncResult {
  status: "ok" | "conflict" | "error";
  message: string;
}

export type AuthMethod =
  | { type: "local-git"; path: string }
  | { type: "github-api"; token: string };

// Zod schemas for validation

export const createMemorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(MEMORY_TYPES),
  body: z.string().min(1),
  description: z.string().max(200).optional(),
  profile: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateMemorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(MEMORY_TYPES).optional(),
  body: z.string().min(1).optional(),
  description: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
});

export const searchMemorySchema = z.object({
  query: z.string().min(1),
  type: z.enum(MEMORY_TYPES).optional(),
  profile: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const listMemorySchema = z.object({
  type: z.enum(MEMORY_TYPES).optional(),
  profile: z.string().optional(),
  sort: z.enum(["updated", "importance", "created"]).default("updated"),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type SearchMemoryInput = z.infer<typeof searchMemorySchema>;
export type ListMemoryInput = z.infer<typeof listMemorySchema>;
