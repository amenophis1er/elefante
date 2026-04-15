import type {
  Manifest,
  Memory,
  MemoryMeta,
  MemoryType,
  SearchIndex,
  SearchResult,
} from "./types.js";
import { listAllMemories, memoryToMeta, readMemory, touchMemory } from "./memory.js";
import { getHeadCommit, readVaultFile, vaultFileExists, writeVaultFile } from "./vault.js";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "or", "she",
  "that", "the", "to", "was", "were", "will", "with", "this",
  "but", "they", "have", "had", "what", "when", "where", "who",
  "which", "how", "not", "no", "do", "does", "did", "can", "could",
  "would", "should", "may", "might", "shall", "must", "if", "then",
  "than", "so", "just", "about", "also", "been", "into", "more",
  "some", "such", "very", "only", "over", "own", "same", "out",
]);

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((v, i, a) => a.indexOf(v) === i);
}

export function extractTrigrams(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  const trigrams: Set<string> = new Set();
  const words = cleaned.split(" ").filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  for (const word of words) {
    for (let i = 0; i <= word.length - 3; i++) {
      trigrams.add(word.substring(i, i + 3));
    }
  }
  return [...trigrams];
}

function memoryText(memory: Memory): string {
  return [memory.name, memory.description ?? "", memory.body].join(" ");
}

export async function rebuildIndex(): Promise<void> {
  const memories = listAllMemories();
  const commitHash = await getHeadCommit();
  const timestamp = new Date().toISOString();

  // Build manifest
  const manifest: Manifest = {
    generated_at: timestamp,
    version: "0.1",
    commit: commitHash,
    count: memories.length,
    memories: memories.map(memoryToMeta),
  };

  // Build search index
  const trigramIndex: Record<string, string[]> = {};
  const keywordIndex: Record<string, string[]> = {};

  for (const memory of memories) {
    const text = memoryText(memory);

    for (const trigram of extractTrigrams(text)) {
      if (!trigramIndex[trigram]) trigramIndex[trigram] = [];
      trigramIndex[trigram].push(memory.id);
    }

    for (const keyword of extractKeywords(text)) {
      if (!keywordIndex[keyword]) keywordIndex[keyword] = [];
      keywordIndex[keyword].push(memory.id);
    }
  }

  const searchIndex: SearchIndex = {
    generated_at: timestamp,
    version: "0.1",
    trigrams: trigramIndex,
    keywords: keywordIndex,
  };

  writeVaultFile("index/manifest.json", JSON.stringify(manifest, null, 2));
  writeVaultFile("index/search.json", JSON.stringify(searchIndex, null, 2));

  // Update in-memory cache to match what we just wrote
  cachedManifest = manifest;
  cachedSearchIndex = searchIndex;
}

// Cached index for search
let cachedSearchIndex: SearchIndex | null = null;
let cachedManifest: Manifest | null = null;

const EMPTY_SEARCH: SearchIndex = { generated_at: "", version: "0.1", trigrams: {}, keywords: {} };
const EMPTY_MANIFEST: Manifest = { generated_at: "", version: "0.1", commit: null, count: 0, memories: [] };

function loadSearchIndex(): SearchIndex {
  if (cachedSearchIndex) return cachedSearchIndex;
  if (!vaultFileExists("index/search.json")) return EMPTY_SEARCH;
  try {
    cachedSearchIndex = JSON.parse(readVaultFile("index/search.json"));
    return cachedSearchIndex!;
  } catch {
    return EMPTY_SEARCH;
  }
}

function loadManifest(): Manifest {
  if (cachedManifest) return cachedManifest;
  if (!vaultFileExists("index/manifest.json")) return EMPTY_MANIFEST;
  try {
    cachedManifest = JSON.parse(readVaultFile("index/manifest.json"));
    return cachedManifest!;
  } catch {
    return EMPTY_MANIFEST;
  }
}

export function invalidateCache(): void {
  cachedSearchIndex = null;
  cachedManifest = null;
}

export async function search(
  query: string,
  filters?: { type?: MemoryType; profile?: string },
  limit: number = 10
): Promise<SearchResult[]> {
  const index = loadSearchIndex();
  const queryTrigrams = extractTrigrams(query);
  const queryKeywords = extractKeywords(query);

  // Score candidates
  const scores: Map<string, number> = new Map();

  for (const trigram of queryTrigrams) {
    const ids = index.trigrams[trigram] ?? [];
    for (const id of ids) {
      scores.set(id, (scores.get(id) ?? 0) + 1);
    }
  }

  for (const keyword of queryKeywords) {
    const ids = index.keywords[keyword] ?? [];
    for (const id of ids) {
      scores.set(id, (scores.get(id) ?? 0) + 2);
    }
  }

  // Load manifest for metadata boosts
  const manifest = loadManifest();
  const metaMap = new Map(manifest.memories.map((m) => [m.id, m]));

  // Apply boosts and filters
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const results: { id: string; score: number }[] = [];

  for (const [id, rawScore] of scores) {
    const meta = metaMap.get(id);
    if (!meta) continue;

    // Apply filters
    if (filters?.type && meta.type !== filters.type) continue;
    if (filters?.profile === "__global__") {
      // "global" sentinel: only return memories with no profile
      if (meta.profile !== null) continue;
    } else if (filters?.profile) {
      // Include memories matching the profile OR global (null) memories
      if (meta.profile !== filters.profile && meta.profile !== null) continue;
    }

    // Recency boost
    const ageMs = nowMs - new Date(meta.updated_at).getTime();
    const recencyFactor = Math.max(0, 1 - ageMs / thirtyDaysMs);
    let score = rawScore * (1 + 0.1 * recencyFactor);

    // Importance boost
    score *= 1 + 0.05 * meta.importance;

    results.push({ id, score });
  }

  // Sort and limit
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, limit);

  // Load full memory content for results
  const searchResults: SearchResult[] = [];
  for (const { id, score } of topResults) {
    const memory = readMemory(id);
    if (memory) {
      searchResults.push({ memory, score });
      // Touch async — don't await
      touchMemory(id).catch(() => {});
    }
  }

  return searchResults;
}

export function listMemories(
  filters?: {
    type?: MemoryType;
    profile?: string;
    sort?: "updated" | "importance" | "created";
  },
  limit: number = 20,
  offset: number = 0
): MemoryMeta[] {
  const manifest = loadManifest();
  let results = manifest.memories;

  // Filter
  if (filters?.type) {
    results = results.filter((m) => m.type === filters.type);
  }
  if (filters?.profile === "__global__") {
    results = results.filter((m) => m.profile === null);
  } else if (filters?.profile) {
    results = results.filter(
      (m) => m.profile === filters.profile || m.profile === null
    );
  }

  // Sort
  const sort = filters?.sort ?? "updated";
  results.sort((a, b) => {
    if (sort === "importance") return b.importance - a.importance;
    if (sort === "created") return b.created_at.localeCompare(a.created_at);
    return b.updated_at.localeCompare(a.updated_at);
  });

  return results.slice(offset, offset + limit);
}
