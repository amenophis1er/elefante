export type {
  Memory,
  MemoryMeta,
  MemoryType,
  VaultConfig,
  SearchResult,
  CreateMemoryInput,
  UpdateMemoryInput,
  SearchMemoryInput,
  ListMemoryInput,
} from "./types.js";

export { MEMORY_TYPES } from "./types.js";
export { createMemory, readMemory, updateMemory, deleteMemory, listAllMemories } from "./memory.js";
export { search, listMemories, rebuildIndex, invalidateCache } from "./indexer.js";
export { init, isInitialized, getStatus, pull, push, getConfig } from "./vault.js";
export { resolveAuth } from "./auth.js";
export { startMcpServer } from "./mcp-server.js";
