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

// --- Stop words ---

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

// --- Stemmer (lightweight suffix stripping) ---

const SUFFIX_RULES: [string, string][] = [
  ["ience", ""],     // persistence → persist, resilience → resili
  ["ence", ""],      // persistence → persist (if ience didn't match)
  ["ance", ""],      // performance → perform
  ["ies", "y"],      // memories → memory, dependencies → dependency
  ["ves", "f"],      // halves → half
  ["ses", "s"],      // databases → database (keep trailing s for words ending in se)
  ["tion", ""],      // authentication → authentica
  ["sion", ""],      // permission → permis
  ["ment", ""],      // environment → environ
  ["ness", ""],      // staleness → stale
  ["able", ""],      // configurable → configur
  ["ible", ""],      // accessible → access
  ["ing", ""],       // testing → test
  ["ful", ""],       // powerful → power
  ["ous", ""],       // dangerous → danger
  ["ive", ""],       // recursive → recurs
  ["ly", ""],        // quickly → quick
  ["ed", ""],        // configured → configur
  ["er", ""],        // linter → lint
  ["es", ""],        // branches → branch
  ["s", ""],         // tests → test
];

export function stem(word: string): string {
  if (word.length < 4) return word;
  for (const [suffix, replacement] of SUFFIX_RULES) {
    if (word.endsWith(suffix) && word.length - suffix.length + replacement.length >= 3) {
      return word.slice(0, -suffix.length) + replacement;
    }
  }
  return word;
}

// --- Synonym dictionary ---

const SYNONYMS: Record<string, string[]> = {
  db: ["database"],
  database: ["db"],
  auth: ["authentication", "authorization"],
  authentication: ["auth"],
  authorization: ["auth"],
  env: ["environment"],
  environment: ["env"],
  config: ["configuration"],
  configuration: ["config"],
  repo: ["repository"],
  repository: ["repo"],
  deps: ["dependencies"],
  dependencies: ["deps"],
  infra: ["infrastructure"],
  infrastructure: ["infra"],
  k8s: ["kubernetes"],
  kubernetes: ["k8s"],
  js: ["javascript"],
  javascript: ["js"],
  ts: ["typescript"],
  typescript: ["ts"],
  pkg: ["package"],
  fn: ["function"],
  func: ["function"],
  dir: ["directory"],
  err: ["error"],
  msg: ["message"],
  dev: ["development"],
  prod: ["production"],
  api: ["endpoint", "interface"],
};

// --- Tokenizer ---

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((v, i, a) => a.indexOf(v) === i);
}

/** Extract keywords with stemming applied */
function extractStemmedKeywords(text: string): string[] {
  const raw = extractKeywords(text);
  const stemmed = raw.map(stem);
  // Return unique union of raw + stemmed
  return [...new Set([...raw, ...stemmed])];
}

/** Expand a list of keywords with synonyms. Also expands raw query words (pre-filter) to catch short abbreviations like 'db'. */
function expandWithSynonyms(keywords: string[], rawQueryWords?: string[]): string[] {
  const expanded = new Set(keywords);
  // Also check raw query words for synonym matches (catches short words like 'db' that were filtered out)
  if (rawQueryWords) {
    for (const w of rawQueryWords) {
      const lower = w.toLowerCase();
      const syns = SYNONYMS[lower];
      if (syns) {
        expanded.add(lower);
        for (const s of syns) expanded.add(s);
      }
    }
  }
  for (const kw of keywords) {
    const syns = SYNONYMS[kw];
    if (syns) for (const s of syns) expanded.add(s);
  }
  return [...expanded];
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

// --- Index building ---

function addToPostingList(list: Record<string, string[]>, term: string, id: string): void {
  if (!list[term]) list[term] = [];
  if (!list[term].includes(id)) list[term].push(id);
}

export async function rebuildIndex(): Promise<void> {
  const memories = listAllMemories();
  const commitHash = await getHeadCommit();
  const timestamp = new Date().toISOString();

  const manifest: Manifest = {
    generated_at: timestamp,
    version: "0.2",
    commit: commitHash,
    count: memories.length,
    memories: memories.map(memoryToMeta),
  };

  const fields = {
    name: {} as Record<string, string[]>,
    description: {} as Record<string, string[]>,
    tags: {} as Record<string, string[]>,
    body: {} as Record<string, string[]>,
  };
  const trigramIndex: Record<string, string[]> = {};
  const df: Record<string, number> = {};

  for (const memory of memories) {
    const termsInDoc = new Set<string>();

    // Index each field separately
    for (const kw of extractStemmedKeywords(memory.name)) {
      addToPostingList(fields.name, kw, memory.id);
      termsInDoc.add(kw);
    }

    if (memory.description) {
      for (const kw of extractStemmedKeywords(memory.description)) {
        addToPostingList(fields.description, kw, memory.id);
        termsInDoc.add(kw);
      }
    }

    for (const tag of memory.tags) {
      const normalizedTag = tag.toLowerCase();
      addToPostingList(fields.tags, normalizedTag, memory.id);
      termsInDoc.add(normalizedTag);
      // Also stem the tag
      const stemmedTag = stem(normalizedTag);
      if (stemmedTag !== normalizedTag) {
        addToPostingList(fields.tags, stemmedTag, memory.id);
        termsInDoc.add(stemmedTag);
      }
    }

    for (const kw of extractStemmedKeywords(memory.body)) {
      addToPostingList(fields.body, kw, memory.id);
      termsInDoc.add(kw);
    }

    // Trigrams from all text (for fuzzy/prefix matching)
    const allText = [memory.name, memory.description ?? "", memory.tags.join(" "), memory.body].join(" ");
    for (const trigram of extractTrigrams(allText)) {
      addToPostingList(trigramIndex, trigram, memory.id);
    }

    // Document frequency
    for (const term of termsInDoc) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }

  const searchIndex: SearchIndex = {
    generated_at: timestamp,
    version: "0.2",
    fields,
    trigrams: trigramIndex,
    docCount: memories.length,
    df,
  };

  writeVaultFile("index/manifest.json", JSON.stringify(manifest, null, 2));
  writeVaultFile("index/search.json", JSON.stringify(searchIndex, null, 2));

  cachedManifest = manifest;
  cachedSearchIndex = searchIndex;
}

// --- Cached index ---

let cachedSearchIndex: SearchIndex | null = null;
let cachedManifest: Manifest | null = null;

const EMPTY_FIELDS = { name: {}, description: {}, tags: {}, body: {} };
const EMPTY_SEARCH: SearchIndex = { generated_at: "", version: "0.2", fields: EMPTY_FIELDS, trigrams: {}, docCount: 0, df: {} };
const EMPTY_MANIFEST: Manifest = { generated_at: "", version: "0.2", commit: null, count: 0, memories: [] };

function loadSearchIndex(): SearchIndex {
  if (cachedSearchIndex) return cachedSearchIndex;
  if (!vaultFileExists("index/search.json")) return EMPTY_SEARCH;
  try {
    const raw = JSON.parse(readVaultFile("index/search.json"));
    // Support v0.1 index format (upgrade path)
    if (!raw.fields && raw.keywords) {
      return {
        ...EMPTY_SEARCH,
        fields: { ...EMPTY_FIELDS, body: raw.keywords },
        trigrams: raw.trigrams ?? {},
        docCount: raw.docCount ?? 0,
        df: raw.df ?? {},
      };
    }
    cachedSearchIndex = raw;
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

// --- BM25 scoring ---

const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** Field weights for scoring */
const FIELD_WEIGHTS: Record<string, number> = {
  name: 10,
  tags: 8,
  description: 5,
  body: 1,
};

function idf(docFreq: number, totalDocs: number): number {
  if (docFreq === 0 || totalDocs === 0) return 0;
  return Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);
}

// --- Search ---

export async function search(
  query: string,
  filters?: { type?: MemoryType; profile?: string },
  limit: number = 10
): Promise<SearchResult[]> {
  const index = loadSearchIndex();
  const queryWords = query.toLowerCase().replace(/[^\w\s-]/g, " ").split(/\s+/).filter(Boolean);
  const queryRaw = extractKeywords(query);
  const queryStemmed = queryRaw.map(stem);
  const queryExpanded = expandWithSynonyms([...new Set([...queryRaw, ...queryStemmed])], queryWords);
  const queryTrigrams = extractTrigrams(query);

  const scores: Map<string, number> = new Map();

  // Field-weighted keyword scoring with BM25 IDF
  for (const term of queryExpanded) {
    const termIdf = idf(index.df[term] ?? 0, index.docCount);

    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const postingList = index.fields[field as keyof typeof index.fields] ?? {};
      const ids = postingList[term] ?? [];
      for (const id of ids) {
        scores.set(id, (scores.get(id) ?? 0) + termIdf * weight);
      }
    }
  }

  // Trigram scoring (low weight, helps with fuzzy/prefix matching)
  for (const trigram of queryTrigrams) {
    const ids = index.trigrams[trigram] ?? [];
    for (const id of ids) {
      scores.set(id, (scores.get(id) ?? 0) + 0.3);
    }
  }

  // Exact title match bonus
  const queryLower = query.toLowerCase().trim();
  const manifest = loadManifest();
  const metaMap = new Map(manifest.memories.map((m) => [m.id, m]));

  for (const [id, meta] of metaMap) {
    if (!scores.has(id)) continue;
    const nameLower = meta.name.toLowerCase();
    if (nameLower === queryLower) {
      // Exact match
      scores.set(id, (scores.get(id) ?? 0) + 50);
    } else if (nameLower.includes(queryLower)) {
      // Substring match in title
      scores.set(id, (scores.get(id) ?? 0) + 20);
    }
  }

  // Phrase proximity bonus: if query has 2+ words, bonus when they appear in name/description
  if (queryRaw.length >= 2) {
    const phraseStr = queryRaw.join(" ");
    for (const [id, meta] of metaMap) {
      if (!scores.has(id)) continue;
      const nameLower = meta.name.toLowerCase();
      const descLower = (meta.description ?? "").toLowerCase();
      if (nameLower.includes(phraseStr)) {
        scores.set(id, (scores.get(id) ?? 0) + 15);
      } else if (descLower.includes(phraseStr)) {
        scores.set(id, (scores.get(id) ?? 0) + 8);
      }
    }
  }

  // Apply filters and boosts
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const results: { id: string; score: number }[] = [];

  for (const [id, rawScore] of scores) {
    const meta = metaMap.get(id);
    if (!meta) continue;

    // Apply filters
    if (filters?.type && meta.type !== filters.type) continue;
    if (filters?.profile === "__global__") {
      if (meta.profile !== null) continue;
    } else if (filters?.profile) {
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

  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, limit);

  const searchResults: SearchResult[] = [];
  for (const { id, score } of topResults) {
    const memory = readMemory(id);
    if (memory) {
      searchResults.push({ memory, score });
      touchMemory(id).catch(() => {});
    }
  }

  return searchResults;
}

// --- List ---

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

  const sort = filters?.sort ?? "updated";
  results.sort((a, b) => {
    if (sort === "importance") return b.importance - a.importance;
    if (sort === "created") return b.created_at.localeCompare(a.created_at);
    return b.updated_at.localeCompare(a.updated_at);
  });

  return results.slice(offset, offset + limit);
}
